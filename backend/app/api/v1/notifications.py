import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_family, get_current_user
from app.models.family import Family
from app.models.user import User
from app.schemas.notification import NotificationOut
from app.services.notification_service import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=List[NotificationOut])
def list_notifications(
    family: Family = Depends(get_current_family),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifs = notification_service.list_notifications(
        db=db,
        family_id=family.id,
        recipient_user_id=current_user.id,
    )
    return [
        NotificationOut(
            id=str(n.id),
            family_id=str(n.family_id),
            recipient_user_id=str(n.recipient_user_id) if n.recipient_user_id else None,
            parent_profile_id=str(n.parent_profile_id) if n.parent_profile_id else None,
            title=n.title,
            message=n.message,
            notification_type=n.notification_type,  # type: ignore
            is_read=n.is_read,
            delivered_at=n.delivered_at,
            created_at=n.created_at,
        )
        for n in notifs
    ]

@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
):
    notification_service.mark_read(db, uuid.UUID(notification_id))
    return None
