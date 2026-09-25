import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import select, or_

from app.models.device_token import DeviceToken
from app.models.notification_delivery import NotificationDelivery
from app.models.notification import Notification
from services_runtime.config import runtime_config
from services_runtime.delivery.base import NotificationProvider, PushPayload, DeliveryResult
from services_runtime.delivery.providers.expo import ExpoPushProvider
from services_runtime.delivery.providers.mock import MockProvider

logger = logging.getLogger(__name__)

class NotificationDispatcher:
    def __init__(self, provider: Optional[NotificationProvider] = None):
        if provider:
            self.provider = provider
        elif runtime_config.USE_MOCK_PROVIDER:
            self.provider = MockProvider()
        else:
            self.provider = ExpoPushProvider()

    async def dispatch_to_recipient(
        self,
        db: Session,
        payload: PushPayload,
        notification: Optional[Notification] = None,
        user_id: Optional[uuid.UUID] = None,
        parent_profile_id: Optional[uuid.UUID] = None,
    ) -> List[DeliveryResult]:
        """
        Resolves active device tokens for user_id or parent_profile_id,
        sends push notification via provider, and records delivery attempt in DB.
        """
        conditions = []
        if user_id:
            conditions.append(DeviceToken.user_id == user_id)
        if parent_profile_id:
            conditions.append(DeviceToken.parent_profile_id == parent_profile_id)

        if not conditions:
            logger.warning("dispatch_to_recipient called without user_id or parent_profile_id")
            return []

        # Find active tokens
        query = select(DeviceToken).where(
            DeviceToken.is_active.is_(True),
            or_(*conditions),
        )
        devices = db.scalars(query).all()

        if not devices:
            logger.info(f"No active device tokens found for user_id={user_id}, parent_profile_id={parent_profile_id}")
            return []

        tokens = [d.token for d in devices]
        device_map = {d.token: d for d in devices}

        results = await self.provider.send_batch(tokens, payload)
        now = datetime.now(timezone.utc)

        # Audit delivery attempts
        for res in results:
            matching_device = device_map.get(res.token)
            delivery_record = NotificationDelivery(
                notification_id=notification.id if notification else None,
                device_token_id=matching_device.id if matching_device else None,
                recipient_token=res.token,
                provider=res.provider,
                status=res.status,
                error_message=res.error_message,
                sent_at=now,
            )
            db.add(delivery_record)

            # Invalidate unregistered tokens
            if res.status == "device_not_registered" and matching_device:
                matching_device.is_active = False
                logger.info(f"Deactivated dead device token {matching_device.token}")

        db.commit()
        return results

dispatcher = NotificationDispatcher()
