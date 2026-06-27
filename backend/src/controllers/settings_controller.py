"""Settings controller - audit log + available AI models."""
from fastapi import APIRouter, Depends

from ..config import db
from ..middleware import get_current_user
from ..services.ai_service import AVAILABLE_MODELS

router = APIRouter(tags=["settings"])


@router.get("/audit-logs")
async def list_audit(user: dict = Depends(get_current_user)):
    cur = db.audit_logs.find({"user_id": user["user_id"]}, {"_id": 0}).sort("ts", -1).limit(100)
    return await cur.to_list(100)


@router.get("/models")
async def list_models():
    return {"models": AVAILABLE_MODELS}
