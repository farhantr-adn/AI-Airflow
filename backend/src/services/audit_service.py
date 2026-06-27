"""Audit log service."""
from ..config import db
from ..utils import iso, new_id, now_utc


async def audit(user_id: str, action: str, meta: dict) -> None:
    await db.audit_logs.insert_one({
        "id": new_id("aud"),
        "user_id": user_id,
        "action": action,
        "meta": meta,
        "ts": iso(now_utc()),
    })
