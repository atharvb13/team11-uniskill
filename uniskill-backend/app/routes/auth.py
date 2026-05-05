import os
from typing import Any

import bcrypt
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError

from app.supabase_clients import supabase_admin_client, supabase_auth_client
from app.utils.auth_env import is_auto_confirm_email_enabled
from app.utils.validation import validate_login_input, validate_registration_input

router = APIRouter()
BCRYPT_ROUNDS = 12
DEFAULT_FRONTEND_ORIGIN = "http://localhost:5173"


class RegisterBody(BaseModel):
    firstName: str
    lastName: str
    username: str
    email: str
    password: str


class LoginBody(BaseModel):
    identifier: str | None = Field(default=None)
    email: str | None = Field(default=None)
    password: str


def _json_error(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": message})


def _json_error_with_meta(
    status: int,
    message: str,
    *,
    code: str | None = None,
    field: str | None = None,
) -> JSONResponse:
    payload: dict[str, Any] = {"error": message}
    if code:
        payload["code"] = code
    if field:
        payload["field"] = field
    return JSONResponse(status_code=status, content=payload)


def _api_error_text(e: APIError) -> str:
    # postgrest APIError can wrap details in various shapes; str(e) is safest fallback.
    message = getattr(e, "message", None)
    details = getattr(e, "details", None)
    text = " ".join(str(x) for x in (message, details) if x).strip()
    return text or str(e)


def _is_proxy_or_network_error(text: str) -> bool:
    lower = text.lower()
    return (
        "proxyerror" in lower
        or "proxy error" in lower
        or "403 forbidden" in lower
        or "connecterror" in lower
        or "connection error" in lower
        or "timed out" in lower
    )


@router.post("/register")
def register(body: RegisterBody) -> Any:
    validation = validate_registration_input(body.model_dump())
    if not validation["ok"]:
        return _json_error(400, validation["message"])

    email = validation["email"]
    password = validation["password"]
    first_name = validation["firstName"]
    last_name = validation["lastName"]
    username = validation["username"]

    auto_confirm = is_auto_confirm_email_enabled()
    frontend_origin = (os.environ.get("FRONTEND_ORIGIN") or DEFAULT_FRONTEND_ORIGIN).rstrip("/")
    email_redirect_to = f"{frontend_origin}/email-confirmed"

    user_id: str | None = None

    try:
        existing_username = (
            supabase_admin_client.table("users")
            .select("id")
            .eq("username", username)
            .limit(1)
            .execute()
            .data
            or []
        )
        if existing_username:
            return _json_error_with_meta(
                409,
                "Username is already taken.",
                code="username_taken",
                field="username",
            )
    except Exception:
        # Best-effort pre-check: if this query fails, continue and rely on auth/insert conflict handling below.
        pass

    try:
        if auto_confirm:
            created = supabase_admin_client.auth.admin.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {
                        "username": username,
                        "first_name": first_name,
                        "last_name": last_name,
                    },
                }
            )
            u = created.user
            if not u or not u.id:
                return _json_error(500, "Failed to create auth user.")
            user_id = str(u.id)
            supabase_admin_client.auth.admin.update_user_by_id(user_id, {"email_confirm": True})
        else:
            sign_up_res = supabase_auth_client.auth.sign_up(
                {
                    "email": email,
                    "password": password,
                    "options": {
                        "email_redirect_to": email_redirect_to,
                        "data": {
                            "username": username,
                            "first_name": first_name,
                            "last_name": last_name,
                        },
                    },
                }
            )
            u = sign_up_res.user
            if not u or not u.id:
                return _json_error(500, "Failed to create auth user.")
            user_id = str(u.id)
    except AuthApiError as e:
        lower = (e.message or "").lower()
        if "already" in lower and "register" in lower:
            return _json_error_with_meta(
                409,
                "Email is already registered.",
                code="email_taken",
                field="email",
            )
        return _json_error(400, e.message or "Could not register with the provided details.")
    except Exception as e:
        if _is_proxy_or_network_error(str(e)):
            return _json_error(
                503,
                "Backend cannot reach Supabase auth right now (network/proxy issue).",
            )
        return _json_error(500, "Could not create auth user.")

    password_hash_bytes = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS))
    password_hash = password_hash_bytes.decode("utf-8")

    try:
        supabase_admin_client.table("users").insert(
            {
                "id": user_id,
                "username": username,
                "first_name": first_name,
                "last_name": last_name,
                "contact_email": email,
                "password_hash": password_hash,
            }
        ).execute()
    except APIError as e:
        if user_id:
            try:
                supabase_admin_client.auth.admin.delete_user(user_id)
            except AuthApiError:
                pass

        text = _api_error_text(e).lower()
        if "users_username_key" in text or ("duplicate key" in text and "username" in text):
            return _json_error_with_meta(
                409,
                "Username is already taken.",
                code="username_taken",
                field="username",
            )
        if "contact_email" in text or ("duplicate key" in text and "email" in text):
            return _json_error_with_meta(
                409,
                "Email is already registered.",
                code="email_taken",
                field="email",
            )
        if "403" in text or "forbidden" in text or "permission denied" in text:
            return _json_error(
                500,
                "Backend Supabase service role key cannot access public.users. Verify SUPABASE_SERVICE_ROLE_KEY in uniskill-backend/.env.",
            )
        return _json_error(500, "Could not finish registration. Please try again.")
    except Exception as e:
        if user_id:
            try:
                supabase_admin_client.auth.admin.delete_user(user_id)
            except Exception:
                pass
        if _is_proxy_or_network_error(str(e)):
            return _json_error(
                503,
                "Backend cannot reach Supabase database right now (network/proxy issue).",
            )
        return _json_error(500, "Could not finish registration. Please try again.")

    payload: dict[str, Any] = {
        "message": "Registration successful.",
        "user": {
            "id": user_id,
            "email": email,
            "firstName": first_name,
            "lastName": last_name,
            "username": username,
        },
    }
    if not auto_confirm:
        payload["nextStep"] = (
            "Check your email for a confirmation link from Supabase. After you confirm, you can sign in. "
            "Ensure Supabase → Authentication → URL configuration includes your app URL and the redirect: "
            + email_redirect_to
        )

    return JSONResponse(status_code=201, content=payload)


@router.post("/login")
def login(body: LoginBody) -> Any:
    validation = validate_login_input(body.model_dump())
    if not validation["ok"]:
        return _json_error(400, validation["message"])

    password = validation["password"]
    if validation["mode"] == "email":
        email = validation["email"]
    else:
        uname = validation["username"]
        try:
            rows = (
                supabase_admin_client.table("users")
                .select("contact_email")
                .eq("username", uname)
                .limit(1)
                .execute()
                .data
                or []
            )
        except APIError:
            return _json_error(500, "Unable to process login right now.")

        if not rows:
            return _json_error(401, "Invalid username or password.")
        resolved = (rows[0].get("contact_email") or "").strip()
        if not resolved:
            return _json_error(401, "Invalid username or password.")
        email = resolved.lower()

    try:
        sign_in_res = supabase_auth_client.auth.sign_in_with_password({"email": email, "password": password})
    except AuthApiError as e:
        try:
            rows = (
                supabase_admin_client.table("users")
                .select("id")
                .eq("contact_email", email)
                .limit(1)
                .execute()
                .data
                or []
            )
            if rows:
                uid = str(rows[0]["id"])
                auth_user_data = supabase_admin_client.auth.admin.get_user_by_id(uid)
                auth_user = auth_user_data.user
                if auth_user and not auth_user.email_confirmed_at:
                    return _json_error(
                        401,
                        "Your email is not confirmed yet. Open the confirmation link from Supabase, or in the "
                        "dashboard go to Authentication → Users and confirm this user. For local dev, set "
                        "AUTO_CONFIRM_EMAIL=true in uniskill-backend/.env and restart the server.",
                    )
        except (AuthApiError, APIError):
            pass
        return _json_error(401, "Invalid username/email or password.")

    session = sign_in_res.session
    user = sign_in_res.user
    if not session or not user:
        return _json_error(401, "Invalid login credentials.")

    return {
        "message": "Login successful.",
        "session": {
            "accessToken": session.access_token,
            "refreshToken": session.refresh_token,
            "expiresAt": session.expires_at,
        },
        "user": {
            "id": str(user.id) if user.id else None,
            "email": user.email,
        },
    }
