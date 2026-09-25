import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_family
from app.models.family import Family
from app.schemas.escalation import AlertOut
from app.services.escalation_service import escalation_service

router = APIRouter(prefix="/alerts", tags=["Alerts & Escalations"])

@router.get("", response_model=List[AlertOut])
def list_alerts(
    today_only: bool = False,
    family: Family = Depends(get_current_family),
    db: Session = Depends(get_db),
):
    return escalation_service.list_alerts(db, family.id, today_only=today_only)

@router.post("/{alert_id}/dismiss", status_code=status.HTTP_204_NO_CONTENT)
def dismiss_alert(
    alert_id: str,
    family: Family = Depends(get_current_family),
    db: Session = Depends(get_db),
):
    escalation_service.dismiss_alert(db, uuid.UUID(alert_id), family.id)
    return None
