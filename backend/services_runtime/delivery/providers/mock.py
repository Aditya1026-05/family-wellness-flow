import uuid
from typing import List
from services_runtime.delivery.base import NotificationProvider, PushPayload, DeliveryResult

class MockProvider(NotificationProvider):
    """
    In-memory mock provider for local unit tests, CI, and simulations.
    Logs dispatches and collects them in an accessible list.
    """
    def __init__(self):
        self.sent_deliveries: List[dict] = []

    @property
    def name(self) -> str:
        return "mock"

    async def send_batch(self, tokens: List[str], payload: PushPayload) -> List[DeliveryResult]:
        results: List[DeliveryResult] = []
        for token in tokens:
            ticket = f"mock-ticket-{uuid.uuid4()}"
            record = {
                "token": token,
                "payload": payload.model_dump(),
                "ticket_id": ticket,
            }
            self.sent_deliveries.append(record)
            results.append(
                DeliveryResult(
                    token=token,
                    provider=self.name,
                    status="sent",
                    ticket_id=ticket,
                )
            )
        return results

    def clear(self):
        self.sent_deliveries.clear()
