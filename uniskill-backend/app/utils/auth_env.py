import os


def is_auto_confirm_email_enabled() -> bool:
    raw = (os.environ.get("AUTO_CONFIRM_EMAIL") or "false").strip().lower()
    return raw in ("true", "1", "yes", "on")
