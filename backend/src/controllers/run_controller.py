"""Run controller - trigger runs, fetch runs, AI AutoFix."""
import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse

from ..config import db
from ..middleware import get_current_user
from ..models import AutoFixIn
from ..services.ai_service import AUTOFIX_SYSTEM_PROMPT, build_autofix_prompt, stream_emergent
from ..services.audit_service import audit
from ..services.pipeline_runner import run_pipeline_task
from ..utils import iso, new_id, now_utc

router = APIRouter(tags=["runs"])


@router.post("/pipelines/{pipeline_id}/run")
async def run_pipeline(pipeline_id: str, bg: BackgroundTasks, user: dict = Depends(get_current_user)):
    pipeline = await db.pipelines.find_one({"id": pipeline_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    run_id = new_id("run")
    run_doc = {
        "id": run_id,
        "pipeline_id": pipeline_id,
        "user_id": user["user_id"],
        "repo_name": pipeline["repo_name"],
        "status": "running",
        "current_stage": None,
        "stage_status": {},
        "stage_started": {},
        "stage_finished": {},
        "logs": [],
        "started_at": iso(now_utc()),
        "finished_at": None,
        "failed_stage": None,
        "commit_sha": None,
    }
    await db.pipeline_runs.insert_one(run_doc)
    bg.add_task(run_pipeline_task, run_id, pipeline)
    await audit(user["user_id"], "pipeline.run", {"pipeline_id": pipeline_id, "run_id": run_id})
    return {"run_id": run_id, "status": "running"}


@router.get("/pipelines/{pipeline_id}/runs")
async def list_runs(pipeline_id: str, user: dict = Depends(get_current_user)):
    cur = db.pipeline_runs.find(
        {"pipeline_id": pipeline_id, "user_id": user["user_id"]},
        {"_id": 0, "logs": 0},
    ).sort("started_at", -1)
    return await cur.to_list(100)


@router.get("/runs/{run_id}")
async def get_run(run_id: str, user: dict = Depends(get_current_user)):
    doc = await db.pipeline_runs.find_one({"id": run_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Run not found")
    return doc


@router.get("/runs")
async def list_all_runs(user: dict = Depends(get_current_user)):
    cur = db.pipeline_runs.find({"user_id": user["user_id"]}, {"_id": 0, "logs": 0}).sort("started_at", -1).limit(50)
    return await cur.to_list(50)


@router.post("/runs/{run_id}/autofix")
async def autofix(run_id: str, payload: AutoFixIn, user: dict = Depends(get_current_user)):
    run = await db.pipeline_runs.find_one({"id": run_id, "user_id": user["user_id"]}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run["status"] != "failed":
        raise HTTPException(status_code=400, detail="Run did not fail; nothing to fix")
    pipeline = await db.pipelines.find_one({"id": run["pipeline_id"]}, {"_id": 0})
    prompt = build_autofix_prompt(run, pipeline)

    async def event_gen():
        try:
            async for delta in stream_emergent(
                session_id=f"autofix-{run_id}",
                system_message=AUTOFIX_SYSTEM_PROMPT,
                user_message=prompt,
                provider=payload.provider,
                model=payload.model,
            ):
                yield f"data: {json.dumps({'delta': delta})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
