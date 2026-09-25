import secrets
import string

def generate_secure_invite_token() -> str:
    """Generate a secure, URL-safe token for QR codes and deep links."""
    return secrets.token_urlsafe(32)

def generate_short_code() -> str:
    """Generate a clean 6-character uppercase alphanumeric code for easy manual entry."""
    chars = string.ascii_uppercase + string.digits
    # Exclude easily confused characters like O, 0, I, 1
    safe_chars = [c for c in chars if c not in ("O", "0", "I", "1")]
    return "".join(secrets.choice(safe_chars) for _ in range(6))
