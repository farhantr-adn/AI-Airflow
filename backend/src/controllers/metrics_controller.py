"""Metrics & dashboard controller."""
from fastapi import APIRouter, Depends

from ..config import db
from ..middleware import get_current_user

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/dashboard")
async def dashboard_metrics(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    repos_count = await db.repos.count_documents({"user_id": uid})
    pipelines_count = await db.pipelines.count_documents({"user_id": uid})
    runs_count = await db.pipeline_runs.count_documents({"user_id": uid})
    success_runs = await db.pipeline_runs.count_documents({"user_id": uid, "status": "success"})
    failed_runs = await db.pipeline_runs.count_documents({"user_id": uid, "status": "failed"})
    deployments_count = await db.deployments.count_documents({"user_id": uid, "rolled_back": False})
    recent_runs = (
        await db.pipeline_runs.find({"user_id": uid}, {"_id": 0, "logs": 0})
        .sort("started_at", -1)
        .limit(8)
        .to_list(8)
    )
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
