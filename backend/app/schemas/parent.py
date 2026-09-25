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

class TaskDayDetail(BaseModel):
    task_id: str
    instance_id: str
    title: str
    category: Optional[str] = "Wellness"
    status: str
    scheduled_time: Optional[str] = None
    completed_time: Optional[str] = None

class ParentAdherenceDay(BaseModel):
    day: str
    rate: int
    date: Optional[str] = None
    day_number: Optional[int] = None
    has_tasks: bool = True
    total_tasks: int = 0
    completed_tasks: int = 0
    tasks: List[TaskDayDetail] = []
