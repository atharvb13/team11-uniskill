import re
from typing import Any, Literal, TypedDict

umass_email_re = re.compile(r"^[a-zA-Z0-9._%+-]+@umass\.edu$", re.I)
username_re = re.compile(r"^[a-zA-Z0-9_]{3,30}$")


def normalize_email(email: str | None) -> str:
    return (email or "").strip().lower()


def validate_password(password: str) -> tuple[bool, dict[str, bool]]:
    checks = {
        "minLength": len(password) >= 8,
        "uppercase": bool(re.search(r"[A-Z]", password)),
        "lowercase": bool(re.search(r"[a-z]", password)),
        "number": bool(re.search(r"\d", password)),
    }
    return all(checks.values()), checks


class RegisterOk(TypedDict):
    ok: Literal[True]
    firstName: str
    lastName: str
    username: str
    email: str
    password: str


class RegisterErr(TypedDict):
    ok: Literal[False]
    message: str


def validate_registration_input(payload: dict[str, Any]) -> RegisterOk | RegisterErr:
    first_name = (payload.get("firstName") or "").strip()
    last_name = (payload.get("lastName") or "").strip()
    username = (payload.get("username") or "").strip().lower()
    email = normalize_email(payload.get("email"))
    password = payload.get("password") or ""

    if not first_name:
        return {"ok": False, "message": "First name is required."}
    if not last_name:
        return {"ok": False, "message": "Last name is required."}
    if not username or not username_re.match(username):
        return {
            "ok": False,
            "message": "Username must be 3-30 characters and contain only letters, numbers, or underscores.",
        }
    if not email or not umass_email_re.match(email):
        return {"ok": False, "message": "Use a valid @umass.edu email address."}
    ok, _ = validate_password(password)
    if not ok:
        return {
            "ok": False,
            "message": "Password must be at least 8 characters and include uppercase, lowercase, and a number.",
        }
    return {
        "ok": True,
        "firstName": first_name,
        "lastName": last_name,
        "username": username,
        "email": email,
        "password": password,
    }


class LoginEmailOk(TypedDict):
    ok: Literal[True]
    mode: Literal["email"]
    email: str
    password: str


class LoginUserOk(TypedDict):
    ok: Literal[True]
    mode: Literal["username"]
    username: str
    password: str


class LoginErr(TypedDict):
    ok: Literal[False]
    message: str


LoginResult = LoginEmailOk | LoginUserOk | LoginErr


def validate_login_input(payload: dict[str, Any]) -> LoginResult:
    raw = (payload.get("identifier") or payload.get("email") or "").strip()
    password = payload.get("password") or ""

    if not raw:
        return {"ok": False, "message": "Enter your UMass email or username."}
    if not password:
        return {"ok": False, "message": "Password is required."}

    if "@" in raw:
        email = normalize_email(raw)
        if not email or not umass_email_re.match(email):
            return {"ok": False, "message": "Use a valid @umass.edu email address."}
        return {"ok": True, "mode": "email", "email": email, "password": password}

    username = raw.lower()
    if not username_re.match(username):
        return {
            "ok": False,
            "message": "Username must be 3-30 characters (letters, numbers, underscore).",
        }
    return {"ok": True, "mode": "username", "username": username, "password": password}
