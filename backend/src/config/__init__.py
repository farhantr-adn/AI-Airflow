"""Config package - centralised settings + DB client."""
from .settings import settings
from .database import db, mongo_client

__all__ = ["settings", "db", "mongo_client"]
