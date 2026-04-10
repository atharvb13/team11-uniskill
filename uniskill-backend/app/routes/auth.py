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
        return _json_error(400, e.message)

    password_hash_bytes = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS))
    password_hash = password_hash_bytes.decode("utf-8")

    try:
        supabase_admin_client.table("users").upsert(
            {
                "id": user_id,
                "username": username,
                "first_name": first_name,
                "last_name": last_name,
                "contact_email": email,
                "password_hash": password_hash,
            },
            on_conflict="id",
        ).execute()
    except APIError as e:
        return _json_error(500, str(e))

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
        except APIError as e:
            return _json_error(500, str(e))

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
        return _json_error(401, e.message)

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
