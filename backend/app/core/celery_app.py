import logging

logger = logging.getLogger(__name__)

try:
    from celery import Celery
    from app.core.config import settings

    # Инициализация Celery приложения
    celery_app = Celery(
        "planeasier_worker",
        broker=settings.REDIS_URL,
        backend=settings.REDIS_URL
    )

    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="Europe/Moscow",
        enable_utc=True,
    )
except ImportError:
    logger.warning("Celery not installed; background tasks will be mocked.")
    class DummyCelery:
        def task(self, func):
            def wrapper(*args, **kwargs):
                return func(*args, **kwargs)
            wrapper.delay = lambda *args, **kwargs: type("Task", (), {"id": "mock-task-id"})()
            return wrapper
    celery_app = DummyCelery()

