"""Security controller - mocked Snyk + Trivy scans."""
import random
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..config import db
from ..middleware import get_current_user
from ..utils import iso, new_id, now_utc

router = APIRouter(prefix="/security", tags=["security"])


VULN_TEMPLATES = [
    ("CVE-2024-21538", "high", "cross-spawn", "Regular expression Denial of Service (ReDoS)"),
    ("CVE-2024-43788", "medium", "webpack", "DOM Clobbering vulnerability"),
    ("CVE-2024-37890", "high", "ws", "DoS when handling a request with many HTTP headers"),
    ("CVE-2023-45857", "medium", "axios", "CSRF vulnerability"),
    ("CVE-2024-39338", "low", "axios", "SSRF via path-relative URLs"),
]


@router.post("/scan/{repo_id}")
async def run_security_scan(repo_id: str, user: dict = Depends(get_current_user)):
    repo = await db.repos.find_one({"id": repo_id, "user_id": user["user_id"]}, {"_id": 0})
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
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


@router.get("/scans")
async def list_scans(repo_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["user_id"]}
    if repo_id:
        q["repo_id"] = repo_id
    cur = db.security_scans.find(q, {"_id": 0}).sort("scanned_at", -1).limit(50)
    return await cur.to_list(50)
