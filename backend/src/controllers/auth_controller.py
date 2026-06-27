"""Auth controller - register / login / google / me / logout."""
from datetime import timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response

from ..config import db, settings
from ..middleware import get_current_user, user_out
from ..models import GoogleSessionIn, LoginIn, RegisterIn
from ..utils import hash_pw, iso, make_jwt, new_id, now_utc, verify_pw

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
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
        "role": "admin",
        "picture": None,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user_doc)
    token = make_jwt(uid)
    return {"token": token, "user": user_out(user_doc)}


@router.post("/login")
async def login(payload: LoginIn):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not user.get("password_hash") or not verify_pw(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = make_jwt(user["user_id"])
    return {"token": token, "user": user_out(user)}


@router.post("/google/session")
async def google_session(payload: GoogleSessionIn, response: Response):
    async with httpx.AsyncClient(timeout=10) as cli:
        r = await cli.get(
            settings.EMERGENT_AUTH_SESSION_URL,
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Emergent session")
    data = r.json()
    email = data["email"].lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        uid = existing["user_id"]
        await db.users.update_one(
            {"user_id": uid},
            {"$set": {"name": data.get("name", existing["name"]), "picture": data.get("picture"), "auth_provider": "google"}},
        )
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

    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": uid,
        "session_token": session_token,
        "expires_at": iso(now_utc() + timedelta(days=settings.JWT_EXP_DAYS)),
        "created_at": iso(now_utc()),
    })
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=settings.JWT_EXP_DAYS * 24 * 3600,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return {"user": user_out(user_doc)}


@router.get("/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user_out(user)


@router.post("/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(default=None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}
