from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class InviteCreate(BaseModel):
    parent_profile_id: str
    expires_in_hours: Optional[int] = 48

class InviteOut(BaseModel):
    id: str
    token: str
    code: str
    qr_value: str
    expires_at: datetime
    is_used: bool
    parent_profile_id: str
    parent_name: Optional[str] = None
    family_id: str
    model_config = ConfigDict(from_attributes=True)

class InviteAccept(BaseModel):
    code: str  # Can be the token, QR URL, or 6-digit short code
    device_name: Optional[str] = None
    device_token: Optional[str] = None
    platform: Optional[str] = "ios"


class InviteAcceptOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    parent_profile_id: str
    parent_name: str
    relationship: str
    family_id: str
    family_name: str
    user_id: str
