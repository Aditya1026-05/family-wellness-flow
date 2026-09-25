from datetime import datetime
from typing import Optional, Literal, List
from pydantic import BaseModel, Field, ConfigDict

CategoryType = Literal['Meal', 'Medicine', 'Exercise', 'Appointment', 'Wellness']
TaskStatusType = Literal['pending', 'completed', 'missed', 'snoozed']

class CareTaskCreate(BaseModel):
    title: Optional[str] = None
    name: Optional[str] = None
    category: CategoryType = "Meal"
    parent_profile_id: Optional[str] = None
    parentId: Optional[str] = None
    parent_ids: Optional[List[str]] = None
    parentIds: Optional[List[str]] = None
    scheduled_time: Optional[str] = None
    time: Optional[str] = None
    scheduled_end_time: Optional[str] = None
    end_time: Optional[str] = None
    endTime: Optional[str] = None
    repeat_pattern: Optional[str] = "Daily"
    repeat: Optional[str] = None
    notes: Optional[str] = None
    detail: Optional[str] = None

class CareTaskUpdate(BaseModel):
    title: Optional[str] = None
    name: Optional[str] = None
    category: Optional[CategoryType] = None
    parent_profile_id: Optional[str] = None
    parentId: Optional[str] = None
    parent_ids: Optional[List[str]] = None
    parentIds: Optional[List[str]] = None
    scheduled_time: Optional[str] = None
    time: Optional[str] = None
    scheduled_end_time: Optional[str] = None
    end_time: Optional[str] = None
    endTime: Optional[str] = None
    repeat_pattern: Optional[str] = None
    repeat: Optional[str] = None
    notes: Optional[str] = None
    detail: Optional[str] = None
    is_active: Optional[bool] = None

class ParentTaskStatus(BaseModel):
    parent_id: str
    parentId: str
    parent_name: str
    parentName: str
    relationship: Optional[str] = None
    status: TaskStatusType = "pending"
    completed_at: Optional[datetime] = None
    completed_time: Optional[str] = None
    completedTime: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CareTaskOut(BaseModel):
    id: str
    family_id: str
    parentId: str
    parent_profile_id: str
    parent_ids: List[str] = []
    parentIds: List[str] = []
    assigned_parent_names: List[str] = []
    parent_statuses: List[ParentTaskStatus] = []
    parentStatuses: List[ParentTaskStatus] = []
    name: str
    title: str
    category: CategoryType
    time: str
    scheduled_time: str
    end_time: Optional[str] = None
    endTime: Optional[str] = None
    scheduled_end_time: Optional[str] = None
    status: TaskStatusType = "pending"
    repeat: str = "Daily"
    repeat_pattern: str = "Daily"
    notes: Optional[str] = None
    detail: Optional[str] = None
    is_active: bool = True
    is_ended: bool = False
    isEnded: bool = False
    completed_at: Optional[datetime] = None
    completed_time: Optional[str] = None
    completedTime: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TaskInstanceOut(BaseModel):
    id: str
    taskId: str
    task_id: str
    parentId: str
    parent_profile_id: str
    name: str
    title: str
    category: CategoryType
    time: str
    scheduled_time: str
    scheduled_for: datetime
    end_time: Optional[datetime] = None
    endTime: Optional[str] = None
    scheduled_end_time: Optional[str] = None
    status: TaskStatusType
    repeat: str = "Daily"
    repeat_pattern: str = "Daily"
    completed_at: Optional[datetime] = None
    completed_time: Optional[str] = None
    completedTime: Optional[str] = None
    snoozed_until: Optional[datetime] = None
    notes: Optional[str] = None
    detail: Optional[str] = None
    is_ended: bool = False
    isEnded: bool = False
    model_config = ConfigDict(from_attributes=True)

class TaskCompleteIn(BaseModel):
    parent_id: Optional[str] = None
    parentId: Optional[str] = None
    parent_ids: Optional[List[str]] = None
    parentIds: Optional[List[str]] = None
    all_parents: Optional[bool] = False
    allParents: Optional[bool] = False

class TaskAction(BaseModel):
    action: Literal["complete", "snooze"]
    snooze_minutes: int = Field(default=10, ge=1, le=120)
