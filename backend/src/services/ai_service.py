"""AI service - prompts, model registry, and unified streaming that supports
both the Emergent universal LLM key (via emergentintegrations) and BYOK
(user-supplied OpenAI / Anthropic / OpenAI-compatible keys, e.g. Groq for LLaMA-3).
"""
from typing import AsyncIterator, Optional

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage
from openai import AsyncOpenAI

from ..config import settings
from .registry import AI_PROVIDERS, CLOUD_SERVICES, DEPLOY_STRATEGIES


# ----------------------------- System prompts ---------------------------
_BASE_RULES = """You are Forge, a senior DevOps engineer producing production-grade CI/CD artifacts.
Follow 12-factor app principles. Always include: linting, unit tests with coverage gate,
security scans (Snyk SCA + Trivy container scan), container build with multi-stage Dockerfile assumed,
the requested deploy strategy, and an explicit rollback path. Use caching and parallelization
where supported. Output ONLY the requested artifact — no markdown fences, no commentary."""

PIPELINE_SYSTEM_PROMPT_YAML = _BASE_RULES + """

OUTPUT MODE: YAML pipeline file for the target CI platform.
- GitHub Actions → .github/workflows/ci.yml with jobs: lint, test, security_scan, build, deploy, rollback (workflow_dispatch).
- GitLab CI → .gitlab-ci.yml with stages and explicit `rules:` for rollback (manual).
- Jenkins → declarative Jenkinsfile (Groovy) with stages and a `when { expression { params.ROLLBACK } }` rollback stage.
- Bitbucket Pipelines → bitbucket-pipelines.yml with parallel steps and a custom: rollback pipeline.
"""

PIPELINE_SYSTEM_PROMPT_SCRIPTS = _BASE_RULES + """

OUTPUT MODE: A self-contained set of POSIX shell scripts + a Makefile orchestrator.
Emit each file delimited by a header line of the form:
=== FILE: <relative/path> ===
Then the file contents, then the next header.
Required files:
  - Makefile  (targets: lint, test, security, build, deploy, rollback, ci)
  - scripts/lint.sh
  - scripts/test.sh
  - scripts/security_scan.sh        (snyk test + trivy image)
  - scripts/build.sh                 (multi-stage docker build + tag with $GIT_SHA)
  - scripts/deploy.sh                (deploy according to the strategy + cloud target)
  - scripts/rollback.sh              (revert to previous tag stored in .last_deploy)
Each script must begin with `#!/usr/bin/env bash`, `set -euo pipefail`, and use clearly-named env vars.
"""

PIPELINE_SYSTEM_PROMPT_TERRAFORM = _BASE_RULES + """

OUTPUT MODE: Terraform HCL provisioning the CI/CD infrastructure for the target cloud.
Emit each file delimited by a header line of the form:
=== FILE: <relative/path> ===
Required files for AWS target:
  - main.tf      (provider, CodePipeline, CodeBuild project, S3 artifact bucket, ECR repo)
  - variables.tf (region, repo_name, github_owner, github_repo, branch)
  - outputs.tf   (pipeline_name, ecr_url, codebuild_log_group)
  - buildspec.yml (referenced by the CodeBuild project — includes lint, test, snyk, trivy, build, deploy stages)
For GCP target: use google_cloudbuild_trigger + Artifact Registry.
For Azure target: use azurerm_devops_project + azurerm_container_registry.
Use sensible defaults; reference variables; do not hard-code credentials. Include backend "s3" stub commented out.
"""

PIPELINE_SYSTEM_PROMPT_CFN = _BASE_RULES + """

OUTPUT MODE: AWS CloudFormation YAML provisioning a complete CI/CD pipeline.
Emit a single file delimited by:
=== FILE: cloudformation/pipeline.yaml ===
Resources to include:
  - AWS::S3::Bucket (artifacts)
  - AWS::ECR::Repository
  - AWS::CodeBuild::Project with buildspec inline (lint, test, snyk, trivy, build, push)
  - AWS::CodePipeline::Pipeline with Source (GitHub via CodeStar connection) → Build → DeployToECS stages
  - AWS::Lambda::Function for rollback (invoked by a separate manual stage)
  - All IAM roles & policies needed (least-privilege)
Add Parameters for GitHubOwner, GitHubRepo, Branch, ImageTag. Add Outputs for PipelineName & EcrUri.
"""

AUTOFIX_SYSTEM_PROMPT = """You are Forge AutoFix, an expert SRE that diagnoses failed CI/CD runs.
Given pipeline logs and a failed stage, identify the root cause and propose a concrete fix.
Respond in plain text using this structure:

ROOT CAUSE:
<one paragraph>

FIX:
<numbered steps with code/config snippets where helpful>

PIPELINE PATCH:
<a small YAML / config diff or snippet that would fix it; omit if not applicable>
"""


# ----------------------------- Model registry ---------------------------
AVAILABLE_MODELS = [
    {**m, "provider": p["id"]}
    for p in AI_PROVIDERS
    if p.get("emergent")
    for m in p["models"]
]


# ----------------------------- Prompt builders --------------------------
def system_prompt_for(output_format: str) -> str:
    return {
        "yaml": PIPELINE_SYSTEM_PROMPT_YAML,
        "scripts": PIPELINE_SYSTEM_PROMPT_SCRIPTS,
        "terraform": PIPELINE_SYSTEM_PROMPT_TERRAFORM,
        "cloudformation": PIPELINE_SYSTEM_PROMPT_CFN,
    }.get(output_format, PIPELINE_SYSTEM_PROMPT_YAML)


def build_pipeline_prompt(payload, repo: dict) -> str:
    stack = repo.get("tech_stack", {})
    fmt_hint = {
        "yaml": f"YAML for {payload.target_platform}",
        "scripts": "POSIX shell scripts + Makefile",
        "terraform": f"Terraform HCL for {payload.cloud_target}",
        "cloudformation": "AWS CloudFormation YAML",
    }.get(payload.output_format, "YAML")

    strategy = next((s for s in DEPLOY_STRATEGIES if s["id"] == payload.deploy_strategy), None)
    strategy_hint = (
        f"{strategy['label']} — {strategy['summary']}" if strategy else payload.deploy_strategy
    )
    cloud_service = getattr(payload, "cloud_service", None)
    service_hint = f"{payload.cloud_target} / {cloud_service}" if cloud_service else payload.cloud_target

    return f"""Generate a complete CI/CD artifact ({fmt_hint}) for the following project.

Repository: {repo['full_name']}
Default branch: {repo['default_branch']}
Detected languages: {', '.join(stack.get('languages', [])) or 'unknown'}
Detected frameworks: {', '.join(stack.get('frameworks', [])) or 'unknown'}
Detected tools: {', '.join(stack.get('tools', [])) or 'unknown'}

Pipeline requirements:
- Target CI platform: {payload.target_platform}
- Cloud target / service: {service_hint}
- Deploy strategy: {strategy_hint}
- Minimum test coverage gate: {payload.test_coverage}%
- Enable security scans (Snyk + Trivy): {payload.enable_security}
- Enable monitoring hooks (Prometheus pushgateway / OpenTelemetry exporter): {payload.enable_monitoring}
- Additional requirements: {payload.extra_requirements or 'None'}

Tailor the deploy stage to the strategy:
  - rolling     → use the platform's native rolling-update primitive (kubectl rollout, ECS deployment config).
  - blue-green  → provision two environments and flip traffic via load-balancer / DNS / weighted routing.
  - canary      → deploy a small percentage of replicas, gate promotion on metrics from Prometheus.
  - shadow      → mirror traffic to a parallel deployment without affecting users.
  - big-bang    → straightforward replace; include a clear warning comment that downtime is expected.
  - phased      → stage rollouts across regions/environments with manual approvals between phases.

Output ONLY the artifact content. No markdown fences. No prose.
"""


def build_autofix_prompt(run: dict, pipeline: dict) -> str:
    logs_text = "\n".join(f"[{l.get('stage')}] {l.get('line')}" for l in run.get("logs", [])[-80:])
    return f"""Pipeline target: {pipeline['target_platform']}
Failed stage: {run.get('failed_stage')}
Repo: {pipeline['repo_name']}

Recent logs:
{logs_text}

Diagnose and propose a fix."""


# ----------------------------- Unified streaming ------------------------
async def stream_emergent(*, session_id: str, system_message: str, user_message: str,
                          provider: str, model: str) -> AsyncIterator[str]:
    """Stream via Emergent universal LLM key (Anthropic / OpenAI / Gemini)."""
    chat = LlmChat(
        api_key=settings.EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model(provider, model)
    async for ev in chat.stream_message(UserMessage(text=user_message)):
        if isinstance(ev, TextDelta):
            yield ev.content
        elif isinstance(ev, StreamDone):
            break


async def stream_openai_compat(*, system_message: str, user_message: str,
                               api_key: str, base_url: Optional[str], model: str) -> AsyncIterator[str]:
    """Stream via any OpenAI-compatible endpoint (OpenAI, Groq for LLaMA-3, OpenRouter, etc.)."""
    client = AsyncOpenAI(api_key=api_key, base_url=base_url) if base_url else AsyncOpenAI(api_key=api_key)
    stream = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
        stream=True,
        temperature=0.2,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            yield delta


async def stream_anthropic(*, system_message: str, user_message: str,
                           api_key: str, model: str) -> AsyncIterator[str]:
    """Stream via Anthropic's OpenAI-compatible endpoint (set base_url accordingly)."""
    # Anthropic offers an OpenAI-compat endpoint at https://api.anthropic.com/v1/
    # We use the same AsyncOpenAI client pointed at it.
    client = AsyncOpenAI(api_key=api_key, base_url="https://api.anthropic.com/v1/")
    stream = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
        stream=True,
        temperature=0.2,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            yield delta
