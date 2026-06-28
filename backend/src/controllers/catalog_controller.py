"""Catalog controller - exposes deployment strategies, cloud services, AI providers
to the frontend so the UI stays in sync with backend prompts and validation."""
from fastapi import APIRouter

from ..services.registry import AI_PROVIDERS, CLOUD_SERVICES, DEPLOY_STRATEGIES

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/strategies")
async def list_strategies():
    return {"strategies": DEPLOY_STRATEGIES}


@router.get("/cloud-services")
async def list_cloud_services():
    return {"cloud_services": CLOUD_SERVICES}


@router.get("/ai-providers")
async def list_ai_providers():
    return {"providers": AI_PROVIDERS}
