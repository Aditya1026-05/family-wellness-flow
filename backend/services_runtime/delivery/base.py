from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class PushPayload(BaseModel):
    title: str = Field(..., description="Notification headline")
    body: str = Field(..., description="Notification body content")
    data: Dict[str, Any] = Field(default_factory=dict, description="Metadata payload for mobile client")
    sound: Optional[str] = "default"
    badge: Optional[int] = None
    priority: str = "high"  # default, normal, high
    channel_id: Optional[str] = "carecircle-reminders"

class DeliveryResult(BaseModel):
    token: str
    provider: str
    status: str  # sent, delivered, failed, device_not_registered
    ticket_id: Optional[str] = None
    error_message: Optional[str] = None

class NotificationProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier name."""
        pass

    @abstractmethod
    async def send_batch(self, tokens: List[str], payload: PushPayload) -> List[DeliveryResult]:
        """Dispatches push payload to a batch of tokens."""
        pass
