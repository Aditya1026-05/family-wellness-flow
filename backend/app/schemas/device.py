import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class DeviceTokenRegister(BaseModel):
    token: str = Field(..., description="Expo push token (e.g. ExponentPushToken[...])")
    device_name: Optional[str] = Field(None, description="Human readable device name")
    platform: str = Field("ios", description="Operating system: ios, android, or web")
    provider: str = Field("expo", description="Push provider: expo")
    role: Optional[str] = Field(None, description="Device role: 'parent', 'child', or 'both'")
    parent_id: Optional[str] = None
    parent_profile_id: Optional[str] = None
    user_id: Optional[str] = None
    family_id: Optional[str] = None


class DeviceTokenUnregister(BaseModel):
    token: str = Field(..., description="Expo push token to deactivate")

class DeviceTokenOut(BaseModel):
    id: uuid.UUID
    token: str
    provider: str
    device_name: Optional[str] = None
    platform: str
    is_active: bool
    created_at: datetime
    last_seen_at: datetime

    model_config = {"from_attributes": True}

class NotificationDeliveryOut(BaseModel):
    id: uuid.UUID
    notification_id: Optional[uuid.UUID] = None
    device_token_id: Optional[uuid.UUID] = None
    recipient_token: str
    provider: str
    status: str
    error_message: Optional[str] = None
    sent_at: datetime

    model_config = {"from_attributes": True}
