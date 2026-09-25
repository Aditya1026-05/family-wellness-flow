import uuid
from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.notification import Notification

class NotificationProvider:
    """
    Interface for notification delivery.
    In MVP, logs and saves records to database.
    Can be replaced or extended with Firebase Cloud Messaging (FCM) or APNS.
    """
    def deliver(self, notification: Notification) -> bool:
        # Interface point for FCM / external push service
        # e.g., fcm_client.send(notification.title, notification.message, token)
        return True

default_provider = NotificationProvider()

class NotificationService:
    def __init__(self, provider: NotificationProvider = default_provider):
        self.provider = provider

    def create_notification(
        self,
        db: Session,
        family_id: uuid.UUID,
        title: str,
        message: str,
        notification_type: str = "reminder",
        recipient_user_id: Optional[uuid.UUID] = None,
        parent_profile_id: Optional[uuid.UUID] = None,
    ) -> Notification:
        notif = Notification(
            family_id=family_id,
            recipient_user_id=recipient_user_id,
            parent_profile_id=parent_profile_id,
            title=title,
            message=message,
            notification_type=notification_type,
            is_read=False,
            delivered_at=datetime.now(timezone.utc),
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)

        # Trigger delivery provider
        self.provider.deliver(notif)
        return notif

    def list_notifications(
        self,
        db: Session,
        family_id: uuid.UUID,
        recipient_user_id: Optional[uuid.UUID] = None,
        limit: int = 50,
    ) -> List[Notification]:
        query = select(Notification).where(Notification.family_id == family_id)
        if recipient_user_id:
            query = query.where(
                (Notification.recipient_user_id == recipient_user_id) |
                (Notification.recipient_user_id.is_(None))
            )
        query = query.order_by(Notification.created_at.desc()).limit(limit)
        return list(db.scalars(query).all())

    def mark_read(self, db: Session, notification_id: uuid.UUID) -> Optional[Notification]:
        notif = db.get(Notification, notification_id)
        if notif:
            notif.is_read = True
            db.commit()
            db.refresh(notif)
        return notif

notification_service = NotificationService()
