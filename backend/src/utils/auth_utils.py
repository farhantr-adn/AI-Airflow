"""Auth primitives: bcrypt hashing + JWT encode/decode."""
from datetime import timedelta
from typing import Optional

import bcrypt
import jwt

from .helpers import now_utc
from ..config import settings


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
        "exp": int((now_utc() + timedelta(days=settings.JWT_EXP_DAYS)).timestamp()),
        "iat": int(now_utc().timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)


def decode_jwt(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
    except Exception:
        return None
