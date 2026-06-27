"""Deployment controller - list, rollback."""
from fastapi import APIRouter, Depends, HTTPException

from ..config import db
from ..middleware import get_current_user
from ..services.audit_service import audit

router = APIRouter(prefix="/deployments", tags=["deployments"])


@router.get("")
async def list_deployments(user: dict = Depends(get_current_user)):
    cur = db.deployments.find({"user_id": user["user_id"]}, {"_id": 0}).sort("deployed_at", -1).limit(100)
    return await cur.to_list(100)


@router.post("/{deployment_id}/rollback")
async def rollback_deployment(deployment_id: str, user: dict = Depends(get_current_user)):
    dep = await db.deployments.find_one({"id": deployment_id, "user_id": user["user_id"]}, {"_id": 0})
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    if dep.get("rolled_back"):
        raise HTTPException(status_code=400, detail="Already rolled back")
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
