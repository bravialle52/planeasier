from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import health, tasks, projects

# Инициализация приложения FastAPI
app = FastAPI(
    title="Planeasier API",
    description="API для программного комплекса Planeasier",
    version="1.0.0"
)

# Настройка CORS для поддержки браузерных запросов с фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(tasks.router, prefix="/api", tags=["tasks"])
app.include_router(projects.router, prefix="/api", tags=["projects"])

@app.on_event("startup")
def on_startup():
    try:
        from app.db.session import engine
        from app.db.models import Base
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Initial DB connect attempt: {e}. Attempting to ensure database 'planeasier' exists...")
        try:
            import psycopg2
            from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
            from app.core.config import settings
            import urllib.parse
            # Parse connection info from DATABASE_URL
            url = urllib.parse.urlparse(settings.DATABASE_URL)
            user = url.username or "postgres"
            pwd = url.password or "1010"
            host = url.hostname or "localhost"
            port = url.port or 5432
            target_db = (url.path or "/planeasier").lstrip("/") or "planeasier"

            # Connect to default postgres DB
            conn = psycopg2.connect(host=host, port=port, user=user, password=pwd, dbname="postgres")
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target_db,))
            if not cur.fetchone():
                cur.execute(f'CREATE DATABASE "{target_db}"')
                print(f"Successfully created database '{target_db}'")
            cur.close()
            conn.close()

            # Retry table creation
            from app.db.session import engine
            from app.db.models import Base
            Base.metadata.create_all(bind=engine)
            print("Successfully initialized database tables.")
        except Exception as inner_err:
            print(f"Warning: Could not initialize database tables: {inner_err}")

