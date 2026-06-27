"""Backend entrypoint - re-exports the FastAPI app from src/app.py.
Supervisor runs `uvicorn server:app` from /app/backend, so this stub keeps that contract
while all real source lives under the modular `src/` tree.
"""
from src.app import app  # noqa: F401
