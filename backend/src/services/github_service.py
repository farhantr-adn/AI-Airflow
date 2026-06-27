"""GitHub service - public-API repo metadata fetching + tech-stack detection."""
import re
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException


def parse_github_url(url: str) -> Optional[Dict[str, str]]:
    m = re.match(r"https?://github\.com/([\w.\-]+)/([\w.\-]+?)(?:\.git)?/?$", url.strip())
    if not m:
        return None
    return {"owner": m.group(1), "repo": m.group(2)}


async def fetch_github_meta(owner: str, repo: str) -> Dict[str, Any]:
    """Fetch public GitHub repo metadata + languages + root tree."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as cli:
        meta_r = await cli.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers={"Accept": "application/vnd.github+json"},
        )
        if meta_r.status_code != 200:
            raise HTTPException(status_code=404, detail=f"GitHub repo not found ({meta_r.status_code})")
        meta = meta_r.json()
        lang_r = await cli.get(
            f"https://api.github.com/repos/{owner}/{repo}/languages",
            headers={"Accept": "application/vnd.github+json"},
        )
        langs = lang_r.json() if lang_r.status_code == 200 else {}
        tree_r = await cli.get(
            f"https://api.github.com/repos/{owner}/{repo}/contents/",
            headers={"Accept": "application/vnd.github+json"},
        )
        tree = (
            [it["name"] for it in tree_r.json()]
            if tree_r.status_code == 200 and isinstance(tree_r.json(), list)
            else []
        )
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
    stack: Dict[str, Any] = {"languages": list(languages.keys())[:5], "frameworks": [], "tools": []}
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
