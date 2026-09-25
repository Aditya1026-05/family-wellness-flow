import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_family, get_current_user, get_caller_identity
from app.models.family import Family
from app.models.user import User
from app.schemas.task import CareTaskCreate, CareTaskUpdate, CareTaskOut, TaskInstanceOut, TaskCompleteIn
from app.services.task_service import task_service

router = APIRouter(prefix="/tasks", tags=["Care Tasks"])

@router.get("", response_model=List[CareTaskOut])
def list_tasks(
    parent_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    family: Family = Depends(get_current_family),
    db: Session = Depends(get_db),
):
    pid = uuid.UUID(parent_id) if parent_id else None
    return task_service.list_tasks(db, family.id, parent_id=pid, category=category)

@router.post("", response_model=CareTaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: CareTaskCreate,
    family: Family = Depends(get_current_family),
    db: Session = Depends(get_db),
):
    return task_service.create_task(db, family.id, task_in)

@router.get("/{task_id}", response_model=CareTaskOut)
def get_task(
    task_id: str,
    family: Family = Depends(get_current_family),
    db: Session = Depends(get_db),
):
    return task_service.get_task_by_id(db, uuid.UUID(task_id), family.id)

@router.put("/{task_id}", response_model=CareTaskOut)
def update_task(
    task_id: str,
    task_in: CareTaskUpdate,
    family: Family = Depends(get_current_family),
    db: Session = Depends(get_db),
):
    return task_service.update_task(db, uuid.UUID(task_id), family.id, task_in)

@router.post("/{task_id}/complete", response_model=TaskInstanceOut)
def complete_task(
    task_id: str,
    payload: Optional[TaskCompleteIn] = None,
    family: Family = Depends(get_current_family),
    db: Session = Depends(get_db),
    actor: dict = Depends(get_caller_identity),
):
    is_parent = (actor.get("role") == "parent")
    target_parent_ids = None
    if payload:
        if payload.parent_ids:
            target_parent_ids = payload.parent_ids
        elif payload.parentIds:
            target_parent_ids = payload.parentIds
        elif payload.parent_id:
            target_parent_ids = [payload.parent_id]
        elif payload.parentId:
            target_parent_ids = [payload.parentId]
    return task_service.complete_task(
        db,
        task_id,
        is_parent=is_parent,
        target_parent_ids=target_parent_ids,
    )

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    family: Family = Depends(get_current_family),
    db: Session = Depends(get_db),
):
    task_service.delete_task(db, uuid.UUID(task_id), family.id)
    return None
