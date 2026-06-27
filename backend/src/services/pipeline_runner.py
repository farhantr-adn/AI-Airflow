"""Pipeline runner - background task that simulates pipeline execution end-to-end."""
import asyncio
import random
import uuid
from typing import List

from ..config import db
from ..utils import iso, new_id, now_utc


STAGE_DURATIONS = {
    "checkout": (1, 2),
    "install": (3, 6),
    "lint": (2, 4),
    "test": (5, 9),
    "security_scan": (4, 7),
    "build": (6, 10),
    "deploy": (4, 8),
    "rollback": (3, 5),
}

STAGE_LOGS_TEMPLATES = {
    "checkout": ["$ git fetch --depth=1 origin {branch}", "$ git checkout {sha}", "HEAD is now at {sha_short}"],
    "install": ["$ Detecting package manager...", "$ Installing dependencies (cached layer)", "+ {dep_count} packages installed in {time}s"],
    "lint": ["$ Running linters...", "✓ No style violations", "✓ ESLint: 0 errors, 0 warnings"],
    "test": ["$ Running unit tests...", "PASS  src/__tests__/api.test.js", "Test Suites: 24 passed, 24 total", "Coverage: 89.3% statements"],
    "security_scan": ["$ snyk test --severity-threshold=high", "✓ No high severity vulnerabilities", "$ trivy image forge:latest", "✓ Container clean"],
    "build": ["$ docker buildx build --push -t registry/{name}:{sha_short} .", "[+] Building 12.4s", "Successfully tagged registry/{name}:{sha_short}"],
    "deploy": ["$ Deploying to {cloud} with {strategy} strategy", "→ Rolling out 3 replicas...", "✓ All pods ready", "🚀 Deployment live at https://{name}.{cloud}.example.com"],
    "rollback": ["$ Rolling back to previous revision...", "✓ Rollback complete"],
}


def stages_for_platform(platform: str) -> List[str]:
    return ["checkout", "install", "lint", "test", "security_scan", "build", "deploy", "rollback"]


async def run_pipeline_task(run_id: str, pipeline: dict, fail_chance: float = 0.15):
    """Background task that simulates pipeline execution."""
    sha = uuid.uuid4().hex
    ctx = {
        "branch": "main",
        "sha": sha,
        "sha_short": sha[:7],
        "dep_count": random.randint(120, 580),
        "time": random.randint(8, 22),
        "name": pipeline["repo_name"].split("/")[-1],
        "cloud": pipeline["cloud_target"],
        "strategy": pipeline["deploy_strategy"],
    }
    stages = pipeline.get("stages", [])
    run_stages = [s for s in stages if s != "rollback"]

    failed = False
    failed_stage = None
    for stage in run_stages:
        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$set": {"current_stage": stage, f"stage_status.{stage}": "running", f"stage_started.{stage}": iso(now_utc())}},
        )
        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$push": {"logs": {"$each": [{"ts": iso(now_utc()), "stage": stage, "line": f"━━━ Stage: {stage} ━━━"}]}}},
        )
        templates = STAGE_LOGS_TEMPLATES.get(stage, ["$ running..."])
        lo, hi = STAGE_DURATIONS[stage]
        total = random.uniform(lo, hi)
        per_line = total / max(len(templates), 1)
        for line in templates:
            await asyncio.sleep(per_line)
            try:
                rendered = line.format(**ctx)
            except Exception:
                rendered = line
            await db.pipeline_runs.update_one(
                {"id": run_id},
                {"$push": {"logs": {"ts": iso(now_utc()), "stage": stage, "line": rendered}}},
            )

        if stage in ("test", "build", "security_scan") and random.random() < fail_chance:
            failed = True
            failed_stage = stage
            err_lines = {
                "test": ["FAIL  src/__tests__/payments.test.js", "● expected 200 but got 500", "Test Suites: 1 failed, 23 passed", "Coverage gate not met (78% < 80%)"],
                "build": ["ERROR: failed to solve: process \"npm run build\" did not complete successfully", "exit code: 1"],
                "security_scan": ["✗ High severity vulnerability found: CVE-2024-XXXXX in lodash@4.17.20", "Fix available: upgrade lodash to 4.17.21"],
            }[stage]
            for line in err_lines:
                await db.pipeline_runs.update_one(
                    {"id": run_id},
                    {"$push": {"logs": {"ts": iso(now_utc()), "stage": stage, "line": line, "level": "error"}}},
                )
            await db.pipeline_runs.update_one(
                {"id": run_id},
                {"$set": {f"stage_status.{stage}": "failed", f"stage_finished.{stage}": iso(now_utc())}},
            )
            break
        else:
            await db.pipeline_runs.update_one(
                {"id": run_id},
                {"$set": {f"stage_status.{stage}": "success", f"stage_finished.{stage}": iso(now_utc())}},
            )

    final_status = "failed" if failed else "success"
    await db.pipeline_runs.update_one(
        {"id": run_id},
        {"$set": {
            "status": final_status,
            "finished_at": iso(now_utc()),
            "failed_stage": failed_stage,
            "commit_sha": ctx["sha_short"],
        }},
    )
    await db.pipelines.update_one({"id": pipeline["id"]}, {"$set": {"last_run_status": final_status}, "$inc": {"run_count": 1}})

    if not failed:
        dep_id = new_id("dep")
        await db.deployments.insert_one({
            "id": dep_id,
            "user_id": pipeline["user_id"],
            "pipeline_id": pipeline["id"],
            "pipeline_run_id": run_id,
            "repo_name": pipeline["repo_name"],
            "environment": "production",
            "version": ctx["sha_short"],
            "cloud_target": pipeline["cloud_target"],
            "strategy": pipeline["deploy_strategy"],
            "url": f"https://{ctx['name']}.{pipeline['cloud_target']}.example.com",
            "status": "live",
            "deployed_at": iso(now_utc()),
            "rolled_back": False,
        })
