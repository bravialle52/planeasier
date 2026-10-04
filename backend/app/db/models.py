from sqlalchemy import Column, String, JSON, DateTime
from app.db.session import Base
import uuid
from datetime import datetime

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, default="Новый проект")
    data = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

