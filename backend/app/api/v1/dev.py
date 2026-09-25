import uuid
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from services_runtime.scheduler.poller import poll_and_dispatch_reminders
from services_runtime.escalations.engine import evaluate_and_escalate_overdue_tasks
from services_runtime.delivery.base import PushPayload
from services_runtime.delivery.dispatcher import dispatcher

router = APIRouter(prefix="/dev", tags=["Development Testing"])

class PushDirectTestRequest(BaseModel):
    token: str = Field(..., description="Expo push token (e.g. ExponentPushToken[...])")
    title: str = Field("CareCircle Test", description="Notification title")
    body: str = Field("This is a live test notification from CareCircle.", description="Notification body")
    data: Optional[Dict[str, Any]] = None

@router.post("/test-reminder/{task_instance_id}", summary="Force-trigger a reminder dispatch for a specific task instance")
async def trigger_test_reminder(
    task_instance_id: uuid.UUID,
    stage: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        dispatched = await poll_and_dispatch_reminders(db, force_instance_id=task_instance_id, force_stage=stage)
        if not dispatched:
            return {
                "status": "not_dispatched",
                "message": "Instance found but no reminder was dispatched (verify task and parent profile exist)",
                "task_instance_id": str(task_instance_id),
            }
        return {
            "status": "success",
            "message": f"Stage {stage if stage is not None else 'auto'} reminder notification dispatched and logged to deliveries",
            "dispatched_instances": [str(d) for d in dispatched],
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/test-escalation/{task_instance_id}", summary="Force-trigger an escalation evaluation for a specific task instance")
async def trigger_test_escalation(
    task_instance_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        escalated = await evaluate_and_escalate_overdue_tasks(db, force_instance_id=task_instance_id)
        return {
            "status": "success",
            "message": "Escalation evaluated and alert generated",
            "escalated_instances": [str(e) for e in escalated],
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/push-test", summary="Directly send an Expo push test notification to a specific token")
async def send_direct_push_test(
    payload: PushDirectTestRequest,
    current_user: User = Depends(get_current_user),
):
    push_payload = PushPayload(
        title=payload.title,
        body=payload.body,
        data=payload.data or {"source": "dev_test"},
    )
    results = await dispatcher.provider.send_batch([payload.token], push_payload)
    return {
        "status": "completed",
        "provider": dispatcher.provider.name,
        "results": [r.model_dump() for r in results],
    }
