from datetime import datetime, timezone, timedelta
from typing import Tuple, Optional

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def get_local_now() -> datetime:
    """Returns current datetime in local timezone."""
    return datetime.now().astimezone()

def get_today_range() -> Tuple[datetime, datetime]:
    """
    Returns (today_start_utc, today_end_utc) representing the local calendar day (00:00 to 24:00)
    converted to UTC. This ensures that when midnight strikes locally, tasks roll over immediately.
    """
    local_now = datetime.now().astimezone()
    local_start = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    local_end = local_start + timedelta(days=1)
    return local_start.astimezone(timezone.utc), local_end.astimezone(timezone.utc)

def get_today_datetime(hour: int, minute: int) -> datetime:
    """
    Returns a UTC datetime for today at the given (hour, minute) in local calendar day.
    """
    local_now = datetime.now().astimezone()
    local_dt = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return local_dt.astimezone(timezone.utc)

def parse_time_string(time_str: str) -> Tuple[int, int]:
    """
    Parses strings like '08:30', '8:30 AM', '1:00 PM', '13:00'
    Returns (hour, minute) in 24h format.
    """
    cleaned = time_str.strip()
    # Check if 12h AM/PM
    upper = cleaned.upper()
    if "AM" in upper or "PM" in upper:
        is_pm = "PM" in upper
        parts = upper.replace("AM", "").replace("PM", "").strip().split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        if is_pm and hour < 12:
            hour += 12
        elif not is_pm and hour == 12:
            hour = 0
        return hour, minute
    else:
        parts = cleaned.split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        return hour, minute

def format_time_12h(hour: int, minute: int) -> str:
    h12 = hour % 12 or 12
    am_pm = "PM" if hour >= 12 else "AM"
    return f"{h12}:{minute:02d} {am_pm}"

def to_local_datetime(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    local_tz = datetime.now().astimezone().tzinfo
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc).astimezone(local_tz)
    return dt.astimezone(local_tz)

def format_datetime_time_12h(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    local_dt = to_local_datetime(dt)
    return format_time_12h(local_dt.hour, local_dt.minute)

def format_relative_time(dt: datetime) -> str:
    local_now = datetime.now().astimezone()
    local_dt = to_local_datetime(dt)
    if not local_dt:
        return "Unknown"

    today = local_now.date()
    event_date = local_dt.date()
    time_str = format_time_12h(local_dt.hour, local_dt.minute)

    diff_seconds = (local_now - local_dt).total_seconds()
    if 0 <= diff_seconds < 60 and today == event_date:
        return "Just now"

    if event_date == today:
        return f"Today at {time_str}"
    elif event_date == today - timedelta(days=1):
        return f"Yesterday at {time_str}"
    else:
        return f"{local_dt.strftime('%b %d')} at {time_str}"

