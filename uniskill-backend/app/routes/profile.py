from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from postgrest.exceptions import APIError
from pydantic import BaseModel
from supabase_auth.errors import AuthApiError

from app.supabase_clients import supabase_admin_client, supabase_auth_client

_PROFILE_SELECT = (
    "id, username, first_name, last_name, contact_email, bio, "
    "date_of_joining, profile_picture_url, created_at, updated_at"
)
_PUBLIC_SELECT = (
    "username, first_name, last_name, bio, date_of_joining, profile_picture_url"
)
_DISCOVER_USER_SELECT = "id, username, first_name, last_name, bio"
_DISCOVER_SKILL_SELECT = (
    "user_id, can_teach, wants_to_learn, proficiency_level, skills(name, category)"
)

router = APIRouter()
_bearer = HTTPBearer()


class UpdateProfileBody(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    bio: str | None = None
    profile_picture_url: str | None = None


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> str:
    token = credentials.credentials
    try:
        res = supabase_auth_client.auth.get_user(token)
        if not res.user or not res.user.id:
            raise HTTPException(status_code=401, detail="Invalid token.")
        return str(res.user.id)
    except AuthApiError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")


@router.get("/me")
def get_profile(user_id: str = Depends(get_current_user_id)) -> Any:
    try:
        rows = (
            supabase_admin_client.table("users")
            .select(_PROFILE_SELECT)
            .eq("id", user_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not rows:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return rows[0]


@router.patch("/me")
def update_profile(
    body: UpdateProfileBody,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    raw = body.model_dump()
    updates: dict[str, Any] = {}
    for k, v in raw.items():
        if v is None:
            continue
        if k in ("first_name", "last_name", "bio"):
            updates[k] = str(v).strip() if isinstance(v, str) else v
            continue
        updates[k] = v

    if not updates:
        return JSONResponse(status_code=400, content={"error": "No fields to update."})

    try:
        supabase_admin_client.table("users").update(updates).eq("id", user_id).execute()
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"message": "Profile updated successfully."}


@router.get("/discover")
def discover_profiles(user_id: str = Depends(get_current_user_id)) -> Any:
    """List other users and their skills for dashboard discovery/search."""
    try:
        users = (
            supabase_admin_client.table("users")
            .select(_DISCOVER_USER_SELECT)
            .neq("id", user_id)
            .order("username")
            .execute()
            .data
            or []
        )
        rows = (
            supabase_admin_client.table("user_skills")
            .select(_DISCOVER_SKILL_SELECT)
            .neq("user_id", user_id)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    by_user: dict[str, dict[str, Any]] = {}
    for u in users:
        uid = str(u.get("id", ""))
        if not uid:
            continue
        by_user[uid] = {
            "id": uid,
            "username": u.get("username"),
            "first_name": u.get("first_name"),
            "last_name": u.get("last_name"),
            "bio": u.get("bio"),
            "teach_skills": [],
            "learn_skills": [],
        }

    for row in rows:
        uid = str(row.get("user_id", ""))
        target = by_user.get(uid)
        if not target:
            continue
        s = row.get("skills")
        skill = s[0] if isinstance(s, list) else s
        if not isinstance(skill, dict):
            continue
        skill_payload = {
            "name": skill.get("name"),
            "category": skill.get("category"),
            "proficiency_level": row.get("proficiency_level"),
        }
        if row.get("can_teach"):
            target["teach_skills"].append(skill_payload)
        if row.get("wants_to_learn"):
            target["learn_skills"].append(skill_payload)

    return list(by_user.values())


@router.get("/{username}")
def get_public_profile(username: str) -> Any:
    try:
        rows = (
            supabase_admin_client.table("users")
            .select(_PUBLIC_SELECT)
            .eq("username", username.lower())
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not rows:
        raise HTTPException(status_code=404, detail="User not found.")
    return rows[0]
