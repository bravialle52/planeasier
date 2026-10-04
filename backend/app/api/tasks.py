from fastapi import APIRouter
from app.core.celery_app import celery_app

router = APIRouter()

@celery_app.task
def dummy_task():
    """Фоновая задача для проверки Celery."""
    return "Задача выполнена"

@router.post("/test-task")
def run_test_task():
    """
    Эндпоинт для запуска тестовой задачи в Celery.
    """
    task = dummy_task.delay()
    return {"task_id": task.id, "status": "Task submitted"}
