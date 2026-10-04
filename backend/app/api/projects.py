from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any

from app.db.session import get_db
from app.db.models import Project

router = APIRouter()

class ProjectData(BaseModel):
    name: str = "Новый проект"
    data: Dict[str, Any]

@router.post("/projects", response_model=dict)
def save_project(project: ProjectData, db: Session = Depends(get_db)):
    """Сохранить проект в базу данных"""
    db_project = Project(name=project.name, data=project.data)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return {"id": db_project.id, "status": "success"}

@router.get("/projects/latest")
def load_latest_project(db: Session = Depends(get_db)):
    """Загрузить последний проект из базы данных"""
    project = db.query(Project).order_by(Project.created_at.desc()).first()
    if not project:
        raise HTTPException(status_code=404, detail="No projects found")
    return {"id": project.id, "name": project.name, "data": project.data}

@router.get("/projects/{project_id}")
def load_project(project_id: str, db: Session = Depends(get_db)):
    """Загрузить проект из базы данных"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"id": project.id, "name": project.name, "data": project.data}
