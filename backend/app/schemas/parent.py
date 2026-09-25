from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class ParentCreate(BaseModel):
    name: str
    relationship: str = "Mom"
    color: Optional[str] = "peach"
    avatar_url: Optional[str] = None

class ParentUpdate(BaseModel):
    name: Optional[str] = None
    relationship: Optional[str] = None
    color: Optional[str] = None
    avatar_url: Optional[str] = None

class ParentOut(BaseModel):
    id: str
    family_id: str
    user_id: Optional[str] = None
    name: str
    relationship: str
    initials: str
    color: str = "peach"
    avatar_url: Optional[str] = None
    lastActivity: str = "Just linked"
    completion: int = 100
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ParentAdherenceDay(BaseModel):
    day: str
    rate: int
