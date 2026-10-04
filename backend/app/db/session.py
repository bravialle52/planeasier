from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Создание подключения к PostgreSQL
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

# Фабрика сессий БД
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для моделей
Base = declarative_base()

def get_db():
    """
    Dependency функция для FastAPI.
    Создает новую сессию для каждого запроса и закрывает после завершения.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
