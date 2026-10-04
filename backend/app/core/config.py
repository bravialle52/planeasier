import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    Настройки приложения.
    Загружаются из переменных окружения.
    """
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:1010@localhost:5432/planeasier")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"

settings = Settings()

