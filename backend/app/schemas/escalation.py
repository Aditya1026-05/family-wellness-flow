from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict

PriorityType = Literal['Low', 'Medium', 'High', 'Critical']
EscalationType = Literal['Escalation', 'Missed task', 'Urgent']
EscalationStatus = Literal['active', 'acknowledged', 'resolved', 'dismissed']

class AlertCreate(BaseModel):
    task_instance_id: str
    parent_profile_id: str
    title: str
    detail: str
    priority: PriorityType = "Medium"
    escalation_type: EscalationType = "Missed task"

class AlertOut(BaseModel):
    id: str
    family_id: str
    task_instance_id: str
    parent_profile_id: str
    parent_name: Optional[str] = None
    parentName: Optional[str] = None
    parent_phone: Optional[str] = None
    parentPhone: Optional[str] = None
    title: str
    detail: str
    priority: PriorityType
    type: EscalationType
    action_type: Optional[str] = "call_parent"
    actionType: Optional[str] = "call_parent"
    status: EscalationStatus
    time: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
