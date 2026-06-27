"""Centralized API router - aggregates all controllers under /api."""
from fastapi import APIRouter

from ..controllers import (
    auth_controller,
    repo_controller,
    pipeline_controller,
    run_controller,
    deployment_controller,
    security_controller,
    metrics_controller,
    settings_controller,
    api_key_controller,
)

api_router = APIRouter(prefix="/api")

# Order doesn't matter functionally, but kept logical for readability
api_router.include_router(auth_controller.router)
api_router.include_router(repo_controller.router)
api_router.include_router(pipeline_controller.router)
api_router.include_router(run_controller.router)
api_router.include_router(deployment_controller.router)
api_router.include_router(security_controller.router)
api_router.include_router(metrics_controller.router)
api_router.include_router(settings_controller.router)
api_router.include_router(api_key_controller.router)


@api_router.get("/")
async def root():
    return {"name": "Forge API", "status": "ok"}
