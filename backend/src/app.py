"""FastAPI app setup - middleware, routers, lifecycle."""
import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from .config import mongo_client, settings
from .routes import api_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

app = FastAPI(title="Forge API", version="1.0.0")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()
