"""Forge - AI-Powered SaaS CI/CD Platform Backend"""
import os
import re
import uuid
import json
import random
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import httpx
import jwt
import bcrypt
import yaml as yamllib
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Cookie, Header, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'forge-dev-secret')
JWT_ALG = os.environ.get('JWT_ALG', 'HS256')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Forge API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger("forge")


# ----------------------------- Helpers ----------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except Exception:
        return False


def make_jwt(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": int((now_utc() + timedelta(days=7)).timestamp()),
        "iat": int(now_utc().timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_jwt(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        return None


# ----------------------------- Models -----------------------------------
class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "developer"
    auth_provider: str = "jwt"
    created_at: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


class RepoConnectIn(BaseModel):
    provider: str  # github | gitlab | bitbucket
    url: str  # public repo URL


class RepoOAuthMockIn(BaseModel):
    provider: str


class PipelineGenIn(BaseModel):
    repo_id: str
    target_platform: str  # github-actions | gitlab-ci | jenkins | bitbucket
    cloud_target: str  # aws | gcp | azure | oracle | cloudflare | on-prem
    deploy_strategy: str  # rolling | blue-green | canary | recreate
    test_coverage: int = 80
    enable_security: bool = True
    enable_monitoring: bool = True
    model: str = "claude-sonnet-4-5-20250929"  # default
    provider: str = "anthropic"  # anthropic | openai | gemini
    extra_requirements: str = ""


class PipelineSaveIn(BaseModel):
    repo_id: str
    name: str
    target_platform: str
    cloud_target: str
    deploy_strategy: str
    yaml_content: str
    model: str
    provider: str
    stages: List[str]


class AutoFixIn(BaseModel):
    model: str = "claude-sonnet-4-5-20250929"
    provider: str = "anthropic"


# ----------------------------- Auth -------------------------------------
async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    session_token: Optional[str] = Cookie(default=None),
) -> dict:
    token = None
    # Cookie first
    if session_token:
        token = session_token
    elif authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Try emergent session token
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if sess:
        exp = sess["expires_at"]
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now_utc():
            raise HTTPException(status_code=401, detail="Session expired")
        user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

    # Fallback: JWT
    payload = decode_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def user_out(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "email": u["email"],
        "name": u["name"],
        "picture": u.get("picture"),
        "role": u.get("role", "developer"),
        "auth_provider": u.get("auth_provider", "jwt"),
        "created_at": u.get("created_at") if isinstance(u.get("created_at"), str) else iso(u.get("created_at") or now_utc()),
    }


@api.post("/auth/register")
async def register(payload: RegisterIn):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = new_id("user")
    user_doc = {
        "user_id": uid,
        "email": payload.email.lower(),
        "name": payload.name,
        "password_hash": hash_pw(payload.password),
        "auth_provider": "jwt",
        "role": "admin",  # first user setup; in real app default to developer
        "picture": None,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user_doc)
    token = make_jwt(uid)
    return {"token": token, "user": user_out(user_doc)}


@api.post("/auth/login")
async def login(payload: LoginIn):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not user.get("password_hash") or not verify_pw(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = make_jwt(user["user_id"])
    return {"token": token, "user": user_out(user)}


@api.post("/auth/google/session")
async def google_session(payload: GoogleSessionIn, response: Response):
    """Exchange Emergent session_id for a session_token + user."""
    async with httpx.AsyncClient(timeout=10) as cli:
        r = await cli.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Emergent session")
    data = r.json()
    email = data["email"].lower()
    # Upsert user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        uid = existing["user_id"]
        await db.users.update_one({"user_id": uid}, {"$set": {
            "name": data.get("name", existing["name"]),
            "picture": data.get("picture"),
            "auth_provider": "google",
        }})
        user_doc = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
    else:
        uid = new_id("user")
        user_doc = {
            "user_id": uid,
            "email": email,
            "name": data.get("name", email.split("@")[0]),
            "picture": data.get("picture"),
            "auth_provider": "google",
            "role": "admin",
            "created_at": iso(now_utc()),
        }
        await db.users.insert_one(user_doc)

    # Store session
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": uid,
        "session_token": session_token,
        "expires_at": iso(now_utc() + timedelta(days=7)),
        "created_at": iso(now_utc()),
    })
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 3600,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return {"user": user_out(user_doc)}


@api.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user_out(user)


@api.post("/auth/logout")
async def logout(response: Response, request: Request, session_token: Optional[str] = Cookie(default=None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ----------------------------- Repo Integration -------------------------
def parse_github_url(url: str) -> Optional[Dict[str, str]]:
    m = re.match(r"https?://github\.com/([\w.\-]+)/([\w.\-]+?)(?:\.git)?/?$", url.strip())
    if not m:
        return None
    return {"owner": m.group(1), "repo": m.group(2)}


async def fetch_github_meta(owner: str, repo: str) -> Dict[str, Any]:
    """Fetch public GitHub repo metadata + tech stack from languages endpoint."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as cli:
        meta_r = await cli.get(f"https://api.github.com/repos/{owner}/{repo}",
                                headers={"Accept": "application/vnd.github+json"})
        if meta_r.status_code != 200:
            raise HTTPException(status_code=404, detail=f"GitHub repo not found ({meta_r.status_code})")
        meta = meta_r.json()
        lang_r = await cli.get(f"https://api.github.com/repos/{owner}/{repo}/languages",
                                headers={"Accept": "application/vnd.github+json"})
        langs = lang_r.json() if lang_r.status_code == 200 else {}
        # Try to fetch root tree for tech detection
        tree_r = await cli.get(
            f"https://api.github.com/repos/{owner}/{repo}/contents/",
            headers={"Accept": "application/vnd.github+json"},
        )
        tree = [it["name"] for it in tree_r.json()] if tree_r.status_code == 200 and isinstance(tree_r.json(), list) else []
    return {
        "name": meta.get("name"),
        "full_name": meta.get("full_name"),
        "description": meta.get("description"),
        "default_branch": meta.get("default_branch", "main"),
        "stars": meta.get("stargazers_count", 0),
        "forks": meta.get("forks_count", 0),
        "languages": langs,
        "root_files": tree,
        "html_url": meta.get("html_url"),
    }


def detect_tech_stack(root_files: List[str], languages: Dict[str, int]) -> Dict[str, Any]:
    files = set(f.lower() for f in root_files)
    stack = {"languages": list(languages.keys())[:5], "frameworks": [], "tools": []}
    if "package.json" in files:
        stack["frameworks"].append("Node.js")
        if "next.config.js" in files or "next.config.mjs" in files:
            stack["frameworks"].append("Next.js")
        if "vite.config.js" in files or "vite.config.ts" in files:
            stack["tools"].append("Vite")
    if "requirements.txt" in files or "pyproject.toml" in files or "setup.py" in files:
        stack["frameworks"].append("Python")
    if "go.mod" in files:
        stack["frameworks"].append("Go")
    if "cargo.toml" in files:
        stack["frameworks"].append("Rust")
    if "pom.xml" in files or "build.gradle" in files:
        stack["frameworks"].append("Java")
    if "dockerfile" in files:
        stack["tools"].append("Docker")
    if "docker-compose.yml" in files or "docker-compose.yaml" in files:
        stack["tools"].append("Docker Compose")
    if ".github" in files:
        stack["tools"].append("GitHub Actions")
    if "kubernetes" in files or "k8s" in files or "helm" in files:
        stack["tools"].append("Kubernetes")
    return stack


@api.post("/repos/connect")
async def connect_repo(payload: RepoConnectIn, user: dict = Depends(get_current_user)):
    if payload.provider == "github":
        info = parse_github_url(payload.url)
        if not info:
            raise HTTPException(status_code=400, detail="Invalid GitHub URL")
        meta = await fetch_github_meta(info["owner"], info["repo"])
        stack = detect_tech_stack(meta["root_files"], meta["languages"])
        repo_id = new_id("repo")
        doc = {
            "id": repo_id,
            "user_id": user["user_id"],
            "provider": "github",
            "name": meta["name"],
            "full_name": meta["full_name"],
            "url": meta["html_url"],
            "default_branch": meta["default_branch"],
            "description": meta.get("description"),
            "stars": meta.get("stars", 0),
            "forks": meta.get("forks", 0),
            "languages": meta["languages"],
            "tech_stack": stack,
            "mocked": False,
            "connected_at": iso(now_utc()),
        }
        await db.repos.insert_one(doc)
        await audit(user["user_id"], "repo.connect", {"repo_id": repo_id, "provider": "github"})
        return {k: v for k, v in doc.items() if k != "_id"}

    # gitlab / bitbucket - mocked
    if payload.provider in ("gitlab", "bitbucket"):
        m = re.search(r"/([\w.\-]+)/([\w.\-]+?)(?:\.git)?/?$", payload.url.strip())
        name = m.group(2) if m else "mock-repo"
        full = f"{m.group(1)}/{m.group(2)}" if m else f"mock/{name}"
        stack = {"languages": ["JavaScript", "Python"], "frameworks": ["Node.js"], "tools": ["Docker"]}
        repo_id = new_id("repo")
        doc = {
            "id": repo_id,
            "user_id": user["user_id"],
            "provider": payload.provider,
            "name": name,
            "full_name": full,
            "url": payload.url,
            "default_branch": "main",
            "description": f"[MOCK] {payload.provider} repository",
            "tech_stack": stack,
            "languages": {"JavaScript": 12000, "Python": 8000},
            "mocked": True,
            "connected_at": iso(now_utc()),
        }
        await db.repos.insert_one(doc)
        await audit(user["user_id"], "repo.connect", {"repo_id": repo_id, "provider": payload.provider, "mocked": True})
        return {k: v for k, v in doc.items() if k != "_id"}

    raise HTTPException(status_code=400, detail="Unknown provider")


@api.post("/repos/oauth-mock/{provider}")
async def oauth_mock(provider: str, user: dict = Depends(get_current_user)):
    """Mocked OAuth flow returning sample repos for a provider."""
    samples = [
        ("payments-api", "Stripe payments microservice in Go", ["Go", "Docker"]),
        ("web-dashboard", "Next.js admin dashboard", ["JavaScript", "TypeScript"]),
        ("ml-pipeline", "Python ML training pipeline", ["Python", "Docker"]),
    ]
    out = []
    for name, desc, langs in samples:
        repo_id = new_id("repo")
        doc = {
            "id": repo_id,
            "user_id": user["user_id"],
            "provider": provider,
            "name": name,
            "full_name": f"{user['name'].split()[0].lower()}/{name}",
            "url": f"https://{provider}.com/{user['name'].split()[0].lower()}/{name}",
            "default_branch": "main",
            "description": desc,
            "tech_stack": {"languages": langs, "frameworks": [], "tools": ["Docker"]},
            "languages": {l: 1000 for l in langs},
            "mocked": True,
            "connected_at": iso(now_utc()),
        }
        await db.repos.insert_one(doc)
        out.append({k: v for k, v in doc.items() if k != "_id"})
    await audit(user["user_id"], "repo.oauth_mock", {"provider": provider, "count": len(out)})
    return out


@api.get("/repos")
async def list_repos(user: dict = Depends(get_current_user)):
    cur = db.repos.find({"user_id": user["user_id"]}, {"_id": 0}).sort("connected_at", -1)
    return await cur.to_list(200)


@api.get("/repos/{repo_id}")
async def get_repo(repo_id: str, user: dict = Depends(get_current_user)):
    doc = await db.repos.find_one({"id": repo_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Repo not found")
    return doc


@api.delete("/repos/{repo_id}")
async def delete_repo(repo_id: str, user: dict = Depends(get_current_user)):
    res = await db.repos.delete_one({"id": repo_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Repo not found")
    await db.pipelines.delete_many({"repo_id": repo_id})
    return {"ok": True}


# ----------------------------- AI Pipeline Generator --------------------
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


def build_user_prompt(payload: PipelineGenIn, repo: dict) -> str:
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


def stages_for_platform(platform: str) -> List[str]:
    return ["checkout", "install", "lint", "test", "security_scan", "build", "deploy", "rollback"]


@api.post("/pipelines/generate")
async def generate_pipeline(payload: PipelineGenIn, user: dict = Depends(get_current_user)):
    repo = await db.repos.find_one({"id": payload.repo_id, "user_id": user["user_id"]}, {"_id": 0})
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"gen-{new_id('s')}",
        system_message=PIPELINE_SYSTEM_PROMPT,
    ).with_model(payload.provider, payload.model)

    async def event_gen():
        buf = []
        try:
            async for ev in chat.stream_message(UserMessage(text=build_user_prompt(payload, repo))):
                if isinstance(ev, TextDelta):
                    buf.append(ev.content)
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
            yield f"data: {json.dumps({'done': True, 'full': ''.join(buf)})}\n\n"
        except Exception as e:
            log.exception("AI gen failed")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@api.post("/pipelines")
async def save_pipeline(payload: PipelineSaveIn, user: dict = Depends(get_current_user)):
    repo = await db.repos.find_one({"id": payload.repo_id, "user_id": user["user_id"]}, {"_id": 0})
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    pid = new_id("pipe")
    doc = {
        "id": pid,
        "user_id": user["user_id"],
        "repo_id": payload.repo_id,
        "repo_name": repo["full_name"],
        "name": payload.name,
        "target_platform": payload.target_platform,
        "cloud_target": payload.cloud_target,
        "deploy_strategy": payload.deploy_strategy,
        "yaml_content": payload.yaml_content,
        "stages": payload.stages or stages_for_platform(payload.target_platform),
        "model": payload.model,
        "provider": payload.provider,
        "created_at": iso(now_utc()),
        "last_run_status": None,
        "run_count": 0,
    }
    await db.pipelines.insert_one(doc)
    await audit(user["user_id"], "pipeline.save", {"pipeline_id": pid})
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/pipelines")
async def list_pipelines(user: dict = Depends(get_current_user)):
    cur = db.pipelines.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(200)


@api.get("/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str, user: dict = Depends(get_current_user)):
    doc = await db.pipelines.find_one({"id": pipeline_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return doc


@api.delete("/pipelines/{pipeline_id}")
async def delete_pipeline(pipeline_id: str, user: dict = Depends(get_current_user)):
    res = await db.pipelines.delete_one({"id": pipeline_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    await db.pipeline_runs.delete_many({"pipeline_id": pipeline_id})
    return {"ok": True}


# ----------------------------- Pipeline Runner (Mocked) -----------------
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
    # don't auto-run rollback as part of normal flow
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
            {"$push": {"logs": {"$each": [
                {"ts": iso(now_utc()), "stage": stage, "line": f"━━━ Stage: {stage} ━━━"},
            ]}}},
        )
        # stream lines
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

        # decide fail
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

    # Create deployment if success
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


@api.post("/pipelines/{pipeline_id}/run")
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


@api.get("/pipelines/{pipeline_id}/runs")
async def list_runs(pipeline_id: str, user: dict = Depends(get_current_user)):
    cur = db.pipeline_runs.find(
        {"pipeline_id": pipeline_id, "user_id": user["user_id"]},
        {"_id": 0, "logs": 0},
    ).sort("started_at", -1)
    return await cur.to_list(100)


@api.get("/runs/{run_id}")
async def get_run(run_id: str, user: dict = Depends(get_current_user)):
    doc = await db.pipeline_runs.find_one({"id": run_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Run not found")
    return doc


@api.get("/runs")
async def list_all_runs(user: dict = Depends(get_current_user)):
    cur = db.pipeline_runs.find({"user_id": user["user_id"]}, {"_id": 0, "logs": 0}).sort("started_at", -1).limit(50)
    return await cur.to_list(50)


# ----------------------------- Auto-Fix ---------------------------------
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


@api.post("/runs/{run_id}/autofix")
async def autofix(run_id: str, payload: AutoFixIn, user: dict = Depends(get_current_user)):
    run = await db.pipeline_runs.find_one({"id": run_id, "user_id": user["user_id"]}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run["status"] != "failed":
        raise HTTPException(status_code=400, detail="Run did not fail; nothing to fix")
    pipeline = await db.pipelines.find_one({"id": run["pipeline_id"]}, {"_id": 0})
    logs_text = "\n".join(f"[{l.get('stage')}] {l.get('line')}" for l in run.get("logs", [])[-80:])
    prompt = f"""Pipeline target: {pipeline['target_platform']}
Failed stage: {run.get('failed_stage')}
Repo: {pipeline['repo_name']}

Recent logs:
{logs_text}

Diagnose and propose a fix."""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"autofix-{run_id}",
        system_message=AUTOFIX_SYSTEM_PROMPT,
    ).with_model(payload.provider, payload.model)

    async def event_gen():
        try:
            async for ev in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ----------------------------- Deployments + Rollback -------------------
@api.get("/deployments")
async def list_deployments(user: dict = Depends(get_current_user)):
    cur = db.deployments.find({"user_id": user["user_id"]}, {"_id": 0}).sort("deployed_at", -1).limit(100)
    return await cur.to_list(100)


@api.post("/deployments/{deployment_id}/rollback")
async def rollback_deployment(deployment_id: str, user: dict = Depends(get_current_user)):
    dep = await db.deployments.find_one({"id": deployment_id, "user_id": user["user_id"]}, {"_id": 0})
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    if dep.get("rolled_back"):
        raise HTTPException(status_code=400, detail="Already rolled back")
    # find prior live deployment for the same pipeline
    prior = await db.deployments.find_one(
        {"pipeline_id": dep["pipeline_id"], "deployed_at": {"$lt": dep["deployed_at"]}, "status": "live"},
        {"_id": 0},
        sort=[("deployed_at", -1)],
    )
    await db.deployments.update_one(
        {"id": deployment_id},
        {"$set": {"status": "rolled_back", "rolled_back": True, "rollback_to": prior["version"] if prior else None}},
    )
    if prior:
        await db.deployments.update_one({"id": prior["id"]}, {"$set": {"status": "live"}})
    await audit(user["user_id"], "deployment.rollback", {"deployment_id": deployment_id, "rollback_to": prior["version"] if prior else None})
    return {"ok": True, "rollback_to": prior["version"] if prior else None}


# ----------------------------- Security Scans (Mocked) ------------------
VULN_TEMPLATES = [
    ("CVE-2024-21538", "high", "cross-spawn", "Regular expression Denial of Service (ReDoS)"),
    ("CVE-2024-43788", "medium", "webpack", "DOM Clobbering vulnerability"),
    ("CVE-2024-37890", "high", "ws", "DoS when handling a request with many HTTP headers"),
    ("CVE-2023-45857", "medium", "axios", "CSRF vulnerability"),
    ("CVE-2024-39338", "low", "axios", "SSRF via path-relative URLs"),
]


@api.post("/security/scan/{repo_id}")
async def run_security_scan(repo_id: str, user: dict = Depends(get_current_user)):
    repo = await db.repos.find_one({"id": repo_id, "user_id": user["user_id"]}, {"_id": 0})
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    # randomly pick subset
    picks = random.sample(VULN_TEMPLATES, k=random.randint(1, 4))
    vulns = [
        {"cve": cve, "severity": sev, "package": pkg, "title": title, "fix_available": True}
        for cve, sev, pkg, title in picks
    ]
    scan_id = new_id("scan")
    doc = {
        "id": scan_id,
        "user_id": user["user_id"],
        "repo_id": repo_id,
        "repo_name": repo["full_name"],
        "tool": "snyk+trivy",
        "vulnerabilities": vulns,
        "summary": {
            "high": sum(1 for v in vulns if v["severity"] == "high"),
            "medium": sum(1 for v in vulns if v["severity"] == "medium"),
            "low": sum(1 for v in vulns if v["severity"] == "low"),
            "total": len(vulns),
        },
        "scanned_at": iso(now_utc()),
    }
    await db.security_scans.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/security/scans")
async def list_scans(repo_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["user_id"]}
    if repo_id:
        q["repo_id"] = repo_id
    cur = db.security_scans.find(q, {"_id": 0}).sort("scanned_at", -1).limit(50)
    return await cur.to_list(50)


# ----------------------------- Dashboard metrics ------------------------
@api.get("/metrics/dashboard")
async def dashboard_metrics(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    repos_count = await db.repos.count_documents({"user_id": uid})
    pipelines_count = await db.pipelines.count_documents({"user_id": uid})
    runs_count = await db.pipeline_runs.count_documents({"user_id": uid})
    success_runs = await db.pipeline_runs.count_documents({"user_id": uid, "status": "success"})
    failed_runs = await db.pipeline_runs.count_documents({"user_id": uid, "status": "failed"})
    deployments_count = await db.deployments.count_documents({"user_id": uid, "rolled_back": False})
    recent_runs = await db.pipeline_runs.find({"user_id": uid}, {"_id": 0, "logs": 0}).sort("started_at", -1).limit(8).to_list(8)
    success_rate = round((success_runs / runs_count) * 100, 1) if runs_count > 0 else 0.0
    return {
        "repos": repos_count,
        "pipelines": pipelines_count,
        "runs": runs_count,
        "successful_runs": success_runs,
        "failed_runs": failed_runs,
        "success_rate": success_rate,
        "deployments": deployments_count,
        "recent_runs": recent_runs,
    }


# ----------------------------- Audit ------------------------------------
async def audit(user_id: str, action: str, meta: dict):
    await db.audit_logs.insert_one({
        "id": new_id("aud"),
        "user_id": user_id,
        "action": action,
        "meta": meta,
        "ts": iso(now_utc()),
    })


@api.get("/audit-logs")
async def list_audit(user: dict = Depends(get_current_user)):
    cur = db.audit_logs.find({"user_id": user["user_id"]}, {"_id": 0}).sort("ts", -1).limit(100)
    return await cur.to_list(100)


# ----------------------------- Available models -------------------------
@api.get("/models")
async def list_models():
    return {
        "models": [
            {"id": "claude-sonnet-4-5-20250929", "provider": "anthropic", "label": "Claude Sonnet 4.5", "recommended": True, "default": True},
            {"id": "claude-sonnet-4-6", "provider": "anthropic", "label": "Claude Sonnet 4.6"},
            {"id": "gpt-5.2", "provider": "openai", "label": "GPT-5.2"},
            {"id": "gpt-5.4", "provider": "openai", "label": "GPT-5.4"},
            {"id": "gemini-3-flash-preview", "provider": "gemini", "label": "Gemini 3 Flash"},
            {"id": "gemini-3.1-pro-preview", "provider": "gemini", "label": "Gemini 3.1 Pro"},
        ]
    }


@api.get("/")
async def root():
    return {"name": "Forge API", "status": "ok"}


# Wire up
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
