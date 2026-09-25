import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_caller_identity
from app.schemas.task import TaskInstanceOut, TaskAction
from app.services.task_service import task_service

router = APIRouter(prefix="/task-instances", tags=["Task Instances"])

@router.get("/parent/{parent_id}/today", response_model=List[TaskInstanceOut])
def get_parent_today_schedule(
    parent_id: str,
    db: Session = Depends(get_db),
):
    return task_service.get_parent_today_instances(db, uuid.UUID(parent_id))

@router.get("/parent/{parent_id}/active", response_model=Optional[TaskInstanceOut])
def get_parent_active_task(
    parent_id: str,
    db: Session = Depends(get_db),
):
    return task_service.get_parent_active_instance(db, uuid.UUID(parent_id))

@router.post("/{instance_or_task_id}/complete", response_model=TaskInstanceOut)
def complete_task(
    instance_or_task_id: str,
    db: Session = Depends(get_db),
    actor: dict = Depends(get_caller_identity),
):
    is_parent = (actor.get("role") == "parent")
    return task_service.complete_task(db, instance_or_task_id, is_parent=is_parent)

@router.post("/{instance_or_task_id}/snooze", response_model=TaskInstanceOut)
def snooze_task(
    instance_or_task_id: str,
    action: Optional[TaskAction] = None,
    db: Session = Depends(get_db),
):
    snooze_min = action.snooze_minutes if action else 10
    return task_service.snooze_task(db, instance_or_task_id, snooze_minutes=snooze_min)
