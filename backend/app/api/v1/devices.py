import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.api.deps import get_caller_identity
from app.models.device_token import DeviceToken
from app.schemas.device import DeviceTokenRegister, DeviceTokenUnregister, DeviceTokenOut, NotificationDeliveryOut

router = APIRouter(prefix="/devices", tags=["Devices"])

@router.post("/register", response_model=DeviceTokenOut, summary="Register or refresh a device push token")
def register_device_token(
    payload: DeviceTokenRegister,
    identity: dict = Depends(get_caller_identity),
    db: Session = Depends(get_db),
):
    if identity.get("role") == "anonymous":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to register device token.",
        )

    user_id: uuid.UUID | None = None
    parent_profile_id: uuid.UUID | None = None

    if identity.get("sub"):
        try:
            user_id = uuid.UUID(identity["sub"])
        except ValueError:
            pass

    if identity.get("parent_profile_id"):
        try:
            parent_profile_id = uuid.UUID(identity["parent_profile_id"])
        except ValueError:
            pass

    now = datetime.now(timezone.utc)
    token_str = payload.token.strip()

    # Check if token is already registered
    device = db.scalar(select(DeviceToken).where(DeviceToken.token == token_str))
    if device:
        device.user_id = user_id or device.user_id
        device.parent_profile_id = parent_profile_id or device.parent_profile_id
        device.provider = payload.provider or device.provider
        device.device_name = payload.device_name or device.device_name
        device.platform = payload.platform or device.platform
        device.is_active = True
        device.last_seen_at = now
    else:
        device = DeviceToken(
            user_id=user_id,
            parent_profile_id=parent_profile_id,
            token=token_str,
            provider=payload.provider or "expo",
            device_name=payload.device_name,
            platform=payload.platform or "ios",
            is_active=True,
            last_seen_at=now,
            created_at=now,
        )
        db.add(device)

    db.commit()
    db.refresh(device)
    return device

@router.post("/unregister", summary="Deactivate a device push token")
def unregister_device_token(
    payload: DeviceTokenUnregister,
    identity: dict = Depends(get_caller_identity),
    db: Session = Depends(get_db),
):
    if identity.get("role") == "anonymous":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    token_str = payload.token.strip()
    device = db.scalar(select(DeviceToken).where(DeviceToken.token == token_str))
    if device:
        device.is_active = False
        db.commit()

    return {"status": "unregistered", "token": token_str}

@router.get("", response_model=List[DeviceTokenOut], summary="List active device tokens for the current caller")
def list_devices(
    identity: dict = Depends(get_caller_identity),
    db: Session = Depends(get_db),
):
    if identity.get("role") == "anonymous":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    sub = identity.get("sub")
    p_id = identity.get("parent_profile_id")

    query = select(DeviceToken).where(DeviceToken.is_active.is_(True))

    conditions = []
    if sub:
        try:
            conditions.append(DeviceToken.user_id == uuid.UUID(sub))
        except ValueError:
            pass
    if p_id:
        try:
            conditions.append(DeviceToken.parent_profile_id == uuid.UUID(p_id))
        except ValueError:
            pass

    if not conditions:
        return []

    from sqlalchemy import or_
    query = query.where(or_(*conditions))
    return db.scalars(query).all()

@router.get("/deliveries", response_model=List[NotificationDeliveryOut], summary="List push notification delivery audit records")
def list_notification_deliveries(
    limit: int = 50,
    db: Session = Depends(get_db),
    identity: dict = Depends(get_caller_identity),
):
    if identity.get("role") == "anonymous":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    from app.models.notification_delivery import NotificationDelivery
    query = select(NotificationDelivery).order_by(NotificationDelivery.sent_at.desc()).limit(limit)
    return db.scalars(query).all()
