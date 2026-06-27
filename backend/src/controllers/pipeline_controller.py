"""Pipeline controller - generate (AI/SSE) / save / list / detail / delete."""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from emergentintegrations.llm.chat import StreamDone, TextDelta, UserMessage

from ..config import db
from ..middleware import get_current_user
from ..models import PipelineGenIn, PipelineSaveIn
from ..services.ai_service import PIPELINE_SYSTEM_PROMPT, build_pipeline_prompt, make_chat
from ..services.audit_service import audit
from ..services.pipeline_runner import stages_for_platform
from ..utils import iso, new_id, now_utc

router = APIRouter(prefix="/pipelines", tags=["pipelines"])
log = logging.getLogger("forge.pipelines")


@router.post("/generate")
async def generate_pipeline(payload: PipelineGenIn, user: dict = Depends(get_current_user)):
    repo = await db.repos.find_one({"id": payload.repo_id, "user_id": user["user_id"]}, {"_id": 0})
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    chat = make_chat(
        session_id=f"gen-{new_id('s')}",
        system_message=PIPELINE_SYSTEM_PROMPT,
        provider=payload.provider,
        model=payload.model,
    )

    async def event_gen():
        buf = []
        try:
            async for ev in chat.stream_message(UserMessage(text=build_pipeline_prompt(payload, repo))):
                if isinstance(ev, TextDelta):
                    buf.append(ev.content)
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
            yield f"data: {json.dumps({'done': True, 'full': ''.join(buf)})}\n\n"
        except Exception as e:
            log.exception("AI gen failed")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("")
async def save_pipeline(payload: PipelineSaveIn, user: dict = Depends(get_current_user)):
    repo = await db.repos.find_one({"id": payload.repo_id, "user_id": user["user_id"]}, {"_id": 0})
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    pid = new_id("pipe")
    doc = {
        "id": pid,
        "user_id": user["user_id"],
        "repo_id": payload.repo_id,
        "repo_name": repo["full_name"],
        "name": payload.name,
        "target_platform": payload.target_platform,
        "cloud_target": payload.cloud_target,
        "deploy_strategy": payload.deploy_strategy,
        "yaml_content": payload.yaml_content,
        "stages": payload.stages or stages_for_platform(payload.target_platform),
        "model": payload.model,
        "provider": payload.provider,
        "created_at": iso(now_utc()),
        "last_run_status": None,
        "run_count": 0,
    }
    await db.pipelines.insert_one(doc)
    await audit(user["user_id"], "pipeline.save", {"pipeline_id": pid})
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("")
async def list_pipelines(user: dict = Depends(get_current_user)):
    cur = db.pipelines.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(200)


@router.get("/{pipeline_id}")
async def get_pipeline(pipeline_id: str, user: dict = Depends(get_current_user)):
    doc = await db.pipelines.find_one({"id": pipeline_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return doc


@router.delete("/{pipeline_id}")
async def delete_pipeline(pipeline_id: str, user: dict = Depends(get_current_user)):
    res = await db.pipelines.delete_one({"id": pipeline_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    await db.pipeline_runs.delete_many({"pipeline_id": pipeline_id})
    return {"ok": True}
