"""Repo controller - connect / list / get / delete / mocked OAuth."""
import re

from fastapi import APIRouter, Depends, HTTPException

from ..config import db
from ..middleware import get_current_user
from ..models import RepoConnectIn
from ..services.audit_service import audit
from ..services.github_service import detect_tech_stack, fetch_github_meta, parse_github_url
from ..utils import iso, new_id, now_utc

router = APIRouter(tags=["repos"])


@router.post("/repos/connect")
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


@router.post("/repos/oauth-mock/{provider}")
async def oauth_mock(provider: str, user: dict = Depends(get_current_user)):
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


@router.get("/repos")
async def list_repos(user: dict = Depends(get_current_user)):
    cur = db.repos.find({"user_id": user["user_id"]}, {"_id": 0}).sort("connected_at", -1)
    return await cur.to_list(200)


@router.get("/repos/{repo_id}")
async def get_repo(repo_id: str, user: dict = Depends(get_current_user)):
    doc = await db.repos.find_one({"id": repo_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Repo not found")
    return doc


@router.delete("/repos/{repo_id}")
async def delete_repo(repo_id: str, user: dict = Depends(get_current_user)):
    res = await db.repos.delete_one({"id": repo_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Repo not found")
    await db.pipelines.delete_many({"repo_id": repo_id})
    return {"ok": True}
