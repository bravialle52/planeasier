from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db
try:
    import redis
except ImportError:
    redis = None
from app.core.config import settings

router = APIRouter()

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Эндпоинт для проверки статуса всех сервисов:
    - FastAPI
    - PostgreSQL
    - Redis
    """
    status = {"status": "ok", "db": "unknown", "redis": "unknown"}
    
    # Проверка БД
    try:
        db.execute(text("SELECT 1"))
        status["db"] = "ok"
    except Exception as e:
        status["db"] = f"error: {str(e)}"
        status["status"] = "error"
        
    # Проверка Redis
    try:
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        status["redis"] = "ok"
    except Exception as e:
        status["redis"] = f"error: {str(e)}"
        status["status"] = "error"
        
    return status
