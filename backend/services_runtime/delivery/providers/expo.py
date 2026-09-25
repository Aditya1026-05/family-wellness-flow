import logging
from typing import List
import httpx

from services_runtime.config import runtime_config
from services_runtime.delivery.base import NotificationProvider, PushPayload, DeliveryResult

logger = logging.getLogger(__name__)

class ExpoPushProvider(NotificationProvider):
    """
    Expo Push Notification HTTP v2 Provider.
    Sends push payloads to https://exp.host/--/api/v2/push/send.
    Handles batching, ticket receipts, and DeviceNotRegistered token invalidation.
    """
    def __init__(self, endpoint_url: str = runtime_config.EXPO_PUSH_URL, access_token: str | None = runtime_config.EXPO_ACCESS_TOKEN):
        self.endpoint_url = endpoint_url
        self.access_token = access_token

    @property
    def name(self) -> str:
        return "expo"

    async def send_batch(self, tokens: List[str], payload: PushPayload) -> List[DeliveryResult]:
        if not tokens:
            return []

        results: List[DeliveryResult] = []
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"

        # Expo recommends batches of up to 100 messages
        batch_size = 100
        for i in range(0, len(tokens), batch_size):
            chunk = tokens[i : i + batch_size]
            messages = [
                {
                    "to": token,
                    "title": payload.title,
                    "body": payload.body,
                    "data": payload.data,
                    "sound": payload.sound,
                    "badge": payload.badge,
                    "priority": payload.priority,
                    "channelId": payload.channel_id,
                }
                for token in chunk
            ]

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(self.endpoint_url, headers=headers, json=messages)
                    if response.status_code == 200:
                        data = response.json().get("data", [])
                        for token, ticket in zip(chunk, data):
                            status = ticket.get("status")
                            if status == "ok":
                                results.append(
                                    DeliveryResult(
                                        token=token,
                                        provider=self.name,
                                        status="sent",
                                        ticket_id=ticket.get("id"),
                                    )
                                )
                            else:
                                details = ticket.get("details", {})
                                error_code = details.get("error")
                                msg = ticket.get("message") or str(details)
                                if error_code == "DeviceNotRegistered":
                                    logger.info(f"Expo token marked DeviceNotRegistered: {token}")
                                    results.append(
                                        DeliveryResult(
                                            token=token,
                                            provider=self.name,
                                            status="device_not_registered",
                                            error_message=msg,
                                        )
                                    )
                                else:
                                    logger.warning(f"Expo push delivery error for {token}: {msg}")
                                    results.append(
                                        DeliveryResult(
                                            token=token,
                                            provider=self.name,
                                            status="failed",
                                            error_message=msg,
                                        )
                                    )
                    else:
                        err_text = response.text[:200]
                        logger.error(f"Expo API HTTP error {response.status_code}: {err_text}")
                        for token in chunk:
                            results.append(
                                DeliveryResult(
                                    token=token,
                                    provider=self.name,
                                    status="failed",
                                    error_message=f"HTTP {response.status_code}: {err_text}",
                                )
                            )
            except Exception as ex:
                logger.error(f"Failed to communicate with Expo push endpoint: {ex}")
                for token in chunk:
                    results.append(
                        DeliveryResult(
                            token=token,
                            provider=self.name,
                            status="failed",
                            error_message=str(ex),
                        )
                    )

        return results
