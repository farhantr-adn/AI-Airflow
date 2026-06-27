"""AI service - prompts + LlmChat factory for pipeline generation and AutoFix."""
from emergentintegrations.llm.chat import LlmChat

from ..config import settings


PIPELINE_SYSTEM_PROMPT = """You are Forge, a senior DevOps engineer that generates production-grade CI/CD pipelines.
Your output must be ONLY valid YAML/Groovy (no markdown fences, no commentary).
You must follow 12-factor app principles, include caching, parallelization, security scans (Snyk + Trivy),
unit tests with coverage gates, container build with multi-stage Dockerfile assumed, and the requested deploy strategy.
Always include explicit job names: lint, test, security_scan, build, deploy, rollback (rollback as a manual/dispatch job).
For GitHub Actions, output a .github/workflows/ci.yml file.
For GitLab CI, output a .gitlab-ci.yml file with stages.
For Jenkins, output a declarative Jenkinsfile (Groovy syntax).
For Bitbucket Pipelines, output a bitbucket-pipelines.yml file.
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


AVAILABLE_MODELS = [
    {"id": "claude-sonnet-4-5-20250929", "provider": "anthropic", "label": "Claude Sonnet 4.5", "recommended": True, "default": True},
    {"id": "claude-sonnet-4-6", "provider": "anthropic", "label": "Claude Sonnet 4.6"},
    {"id": "gpt-5.2", "provider": "openai", "label": "GPT-5.2"},
    {"id": "gpt-5.4", "provider": "openai", "label": "GPT-5.4"},
    {"id": "gemini-3-flash-preview", "provider": "gemini", "label": "Gemini 3 Flash"},
    {"id": "gemini-3.1-pro-preview", "provider": "gemini", "label": "Gemini 3.1 Pro"},
]


def make_chat(session_id: str, system_message: str, provider: str, model: str) -> LlmChat:
    return LlmChat(
        api_key=settings.EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model(provider, model)


def build_pipeline_prompt(payload, repo: dict) -> str:
    stack = repo.get("tech_stack", {})
    return f"""Generate a complete CI/CD pipeline for the following project.

Repository: {repo['full_name']}
Default branch: {repo['default_branch']}
Detected languages: {', '.join(stack.get('languages', [])) or 'unknown'}
Detected frameworks: {', '.join(stack.get('frameworks', [])) or 'unknown'}
Detected tools: {', '.join(stack.get('tools', [])) or 'unknown'}

Pipeline requirements:
- Target platform: {payload.target_platform}
- Cloud target: {payload.cloud_target}
- Deploy strategy: {payload.deploy_strategy}
- Minimum test coverage gate: {payload.test_coverage}%
- Enable security scans (Snyk + Trivy): {payload.enable_security}
- Enable monitoring hooks (Prometheus pushgateway / OpenTelemetry exporter): {payload.enable_monitoring}
- Additional requirements: {payload.extra_requirements or 'None'}

Output ONLY the pipeline file content. No markdown fences. No prose.
"""


def build_autofix_prompt(run: dict, pipeline: dict) -> str:
    logs_text = "\n".join(f"[{l.get('stage')}] {l.get('line')}" for l in run.get("logs", [])[-80:])
    return f"""Pipeline target: {pipeline['target_platform']}
Failed stage: {run.get('failed_stage')}
Repo: {pipeline['repo_name']}

Recent logs:
{logs_text}

Diagnose and propose a fix."""
