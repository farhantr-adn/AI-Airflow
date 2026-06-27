"""MongoDB client + collection refs."""
from motor.motor_asyncio import AsyncIOMotorClient
from .settings import settings

mongo_client = AsyncIOMotorClient(settings.MONGO_URL)
db = mongo_client[settings.DB_NAME]
