"""API Key controller - users save provider keys (OpenAI / Anthropic / OpenAI-compat
e.g. Groq for LLaMA-3) and pick one per pipeline generation."""
from fastapi import APIRouter, Depends, HTTPException

from ..config import db
from ..middleware import get_current_user
from ..models import ApiKeyIn
from ..utils import encrypt, iso, mask, new_id, now_utc

router = APIRouter(prefix="/api-keys", tags=["api-keys"])

ALLOWED_MODES = {"openai", "anthropic", "openai-compat"}


@router.post("")
async def create_key(payload: ApiKeyIn, user: dict = Depends(get_current_user)):
    if payload.mode not in ALLOWED_MODES:
        raise HTTPException(status_code=400, detail=f"mode must be one of {sorted(ALLOWED_MODES)}")
    if payload.mode == "openai-compat" and not payload.base_url:
        raise HTTPException(status_code=400, detail="base_url is required for openai-compat mode")
    kid = new_id("key")
    doc = {
        "id": kid,
        "user_id": user["user_id"],
        "label": payload.label,
        "mode": payload.mode,
        "api_key_encrypted": encrypt(payload.api_key),
        "api_key_masked": mask(payload.api_key),
        "base_url": payload.base_url,
        "default_model": payload.default_model,
        "created_at": iso(now_utc()),
    }
    await db.api_keys.insert_one(doc)
    return _public(doc)


@router.get("")
async def list_keys(user: dict = Depends(get_current_user)):
    cur = db.api_keys.find({"user_id": user["user_id"]}, {"_id": 0, "api_key_encrypted": 0}).sort("created_at", -1)
    return await cur.to_list(50)


@router.delete("/{key_id}")
async def delete_key(key_id: str, user: dict = Depends(get_current_user)):
    res = await db.api_keys.delete_one({"id": key_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"ok": True}


def _public(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k not in ("_id", "api_key_encrypted")}
