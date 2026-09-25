from datetime import datetime, timezone, timedelta
from typing import Tuple

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

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

def format_relative_time(dt: datetime) -> str:
    now = utcnow()
    diff = now - dt
    if diff.total_seconds() < 60:
        return "Just now"
    if diff.days == 0:
        return f"Today at {format_time_12h(dt.hour, dt.minute)}"
    if diff.days == 1:
        return f"Yesterday at {format_time_12h(dt.hour, dt.minute)}"
    return dt.strftime("%b %d at ") + format_time_12h(dt.hour, dt.minute)
