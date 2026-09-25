import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.schemas.auth import UserOut

class FamilyBase(BaseModel):
    name: str = "My Family"

class FamilyCreate(FamilyBase):
    pass

class FamilyMemberOut(BaseModel):
    id: uuid.UUID
    family_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    joined_at: datetime
    user: Optional[UserOut] = None
    model_config = ConfigDict(from_attributes=True)

class FamilyOut(FamilyBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime
    members_count: int = 1
    model_config = ConfigDict(from_attributes=True)
