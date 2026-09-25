from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict

NotificationType = Literal['reminder', 'escalation', 'alert', 'system']

class NotificationCreate(BaseModel):
    family_id: str
    recipient_user_id: Optional[str] = None
    parent_profile_id: Optional[str] = None
    title: str
    message: str
    notification_type: NotificationType = "reminder"

class NotificationOut(BaseModel):
    id: str
    family_id: str
    recipient_user_id: Optional[str] = None
    parent_profile_id: Optional[str] = None
    title: str
    message: str
    notification_type: NotificationType
    is_read: bool
    delivered_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
