import os

class RuntimeConfig:
    POLL_INTERVAL_SECONDS: int = int(os.getenv("RUNTIME_POLL_INTERVAL_SECONDS", "15"))
    DEFAULT_REMINDER_INTERVAL_MINUTES: int = int(os.getenv("RUNTIME_DEFAULT_REMINDER_MINUTES", "0"))
    DEFAULT_ESCALATION_THRESHOLD_MINUTES: int = int(os.getenv("RUNTIME_DEFAULT_ESCALATION_MINUTES", "15"))
    EXPO_PUSH_URL: str = os.getenv("EXPO_PUSH_URL", "https://exp.host/--/api/v2/push/send")
    EXPO_ACCESS_TOKEN: str | None = os.getenv("EXPO_ACCESS_TOKEN", None)
    USE_MOCK_PROVIDER: bool = os.getenv("USE_MOCK_PROVIDER", "false").lower() in ("true", "1", "yes")

runtime_config = RuntimeConfig()
