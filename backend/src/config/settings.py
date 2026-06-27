"""Environment & app settings."""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from /app/backend/.env (PROTECTED VARS kept intact)
BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_ROOT / ".env")


class Settings:
    MONGO_URL: str = os.environ["MONGO_URL"]
    DB_NAME: str = os.environ["DB_NAME"]
    CORS_ORIGINS: list = os.environ.get("CORS_ORIGINS", "*").split(",")
    EMERGENT_LLM_KEY: str = os.environ.get("EMERGENT_LLM_KEY", "")
    JWT_SECRET: str = os.environ.get("JWT_SECRET", "forge-dev-secret")
    JWT_ALG: str = os.environ.get("JWT_ALG", "HS256")
    JWT_EXP_DAYS: int = 7
    EMERGENT_AUTH_SESSION_URL: str = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


settings = Settings()
