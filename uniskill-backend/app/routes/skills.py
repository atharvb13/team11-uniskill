from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from postgrest.exceptions import APIError
from pydantic import BaseModel
from supabase_auth.errors import AuthApiError

from app.supabase_clients import supabase_admin_client, supabase_auth_client

_SKILLS_SELECT = "id, skill_id, proficiency_level, can_teach, wants_to_learn, created_at, skills(name, category)"
_USER_SKILL_ROW = "can_teach, wants_to_learn, proficiency_level"

router = APIRouter()
_bearer = HTTPBearer()

# Allowed values for proficiency_level (teach level when can_teach; goal level when wants_to_learn only).
TeachProficiency = Literal["beginner", "intermediate", "advanced", "expert"]

_ALLOWED_PATCH_KEYS = frozenset({"proficiency_level", "can_teach", "wants_to_learn"})


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> str:
    token = credentials.credentials
    try:
        res = supabase_auth_client.auth.get_user(token)
        if not res.user or not res.user.id:
            raise HTTPException(status_code=401, detail="Invalid token.")
        return str(res.user.id)
    except AuthApiError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    except httpx.HTTPError:
        # Supabase auth transport hiccup; surface as temporary outage instead of 500 traceback.
        raise HTTPException(status_code=503, detail="Auth service temporarily unavailable. Please retry.")


def clean_skill_name(name: str) -> str:
    """Normalize a skill name: strip, collapse spaces, title-case each word."""
    return " ".join(word.capitalize() for word in name.strip().split())


def _raise_api_error(e: APIError) -> None:
    text = str(e)
    lower = text.lower()
    if "proficiency_level" in lower and (
        "check constraint" in lower or "invalid input value for enum" in lower
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Your database currently rejects 'expert' proficiency_level. "
                "Run the SQL in uniskill-backend/supabase-fix-proficiency-level.sql and retry."
            ),
        ) from e
    raise HTTPException(status_code=500, detail=text) from e


class AddUserSkillBody(BaseModel):
    skill_name: str
    category: str | None = None
    proficiency_level: TeachProficiency | None = None
    can_teach: bool = False
    wants_to_learn: bool = False


class UpdateUserSkillBody(BaseModel):
    proficiency_level: TeachProficiency | None = None
    can_teach: bool | None = None
    wants_to_learn: bool | None = None


# ---------------------------------------------------------------------------
# Global skills catalogue
# ---------------------------------------------------------------------------


@router.get("")
def list_skills() -> Any:
    """List all available skills in the catalogue."""
    try:
        rows = (
            supabase_admin_client.table("skills")
            .select("id, name, category, created_at")
            .order("category")
            .order("name")
            .execute()
            .data
            or []
        )
    except APIError as e:
        _raise_api_error(e)
    return rows


# ---------------------------------------------------------------------------
# User skills
# ---------------------------------------------------------------------------


@router.get("/me")
def get_my_skills(user_id: str = Depends(get_current_user_id)) -> Any:
    """Get all skills for the logged-in user."""
    try:
        rows = (
            supabase_admin_client.table("user_skills")
            .select(_SKILLS_SELECT)
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return rows


def _validate_skill_body(body: AddUserSkillBody) -> None:
    if body.can_teach and not body.proficiency_level:
        raise HTTPException(
            status_code=400,
            detail="proficiency_level is required when can_teach is true.",
        )
    if body.wants_to_learn and not body.can_teach and not body.proficiency_level:
        raise HTTPException(
            status_code=400,
            detail="proficiency_level is required when wants_to_learn is true (goal level).",
        )


@router.post("/me", status_code=201)
def add_my_skill(
    body: AddUserSkillBody,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """Add a skill to the logged-in user's profile. Creates the skill if it doesn't exist."""
    _validate_skill_body(body)
    name = clean_skill_name(body.skill_name)
    if not name:
        raise HTTPException(status_code=400, detail="skill_name cannot be empty.")

    try:
        matches = (
            supabase_admin_client.table("skills")
            .select("id, name, category")
            .ilike("name", name)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if matches:
        skill_id = matches[0]["id"]
        created_skill = False
    else:
        new_skill: dict[str, Any] = {"name": name}
        if body.category:
            new_skill["category"] = body.category.strip().title()
        try:
            inserted = (
                supabase_admin_client.table("skills")
                .insert(new_skill)
                .execute()
                .data
            )
        except APIError as e:
            _raise_api_error(e)
        skill_id = inserted[0]["id"]
        created_skill = True

    existing: dict[str, Any] | None = None
    try:
        ex = (
            supabase_admin_client.table("user_skills")
            .select("proficiency_level")
            .eq("user_id", user_id)
            .eq("skill_id", skill_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if ex:
            existing = ex[0]
    except APIError:
        existing = None

    payload: dict[str, Any] = {
        "user_id": user_id,
        "skill_id": skill_id,
        "can_teach": body.can_teach,
        "wants_to_learn": body.wants_to_learn,
    }
    if body.proficiency_level is not None:
        payload["proficiency_level"] = body.proficiency_level
    elif existing and existing.get("proficiency_level") is not None:
        payload["proficiency_level"] = existing["proficiency_level"]

    try:
        result = (
            supabase_admin_client.table("user_skills")
            .upsert(payload, on_conflict="user_id,skill_id")
            .execute()
            .data
        )
    except APIError as e:
        _raise_api_error(e)

    return {
        "message": "Skill added.",
        "skill_created": created_skill,
        "user_skill": result[0] if result else None,
    }


@router.patch("/me/{skill_id}")
def update_my_skill(
    skill_id: str,
    body: UpdateUserSkillBody,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """Update proficiency and teach/learn flags for one of the logged-in user's skills."""
    raw = body.model_dump()
    updates = {k: v for k, v in raw.items() if v is not None and k in _ALLOWED_PATCH_KEYS}

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    try:
        row_check = (
            supabase_admin_client.table("user_skills")
            .select(_USER_SKILL_ROW)
            .eq("user_id", user_id)
            .eq("skill_id", skill_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        _raise_api_error(e)

    if not row_check:
        raise HTTPException(status_code=404, detail="User skill not found.")

    merged: dict[str, Any] = {**row_check[0], **updates}
    if merged.get("can_teach") and not merged.get("proficiency_level"):
        raise HTTPException(
            status_code=400,
            detail="proficiency_level is required when can_teach is true.",
        )

    try:
        result = (
            supabase_admin_client.table("user_skills")
            .update(updates)
            .eq("user_id", user_id)
            .eq("skill_id", skill_id)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not result:
        raise HTTPException(status_code=404, detail="User skill not found.")
    return {"message": "Skill updated.", "user_skill": result[0]}


@router.delete("/me/{skill_id}", status_code=200)
def remove_my_skill(
    skill_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """Remove a skill from the logged-in user's profile."""
    try:
        result = (
            supabase_admin_client.table("user_skills")
            .delete()
            .eq("user_id", user_id)
            .eq("skill_id", skill_id)
            .execute()
            .data
            or []
        )
    except APIError as e:
        _raise_api_error(e)

    if not result:
        raise HTTPException(status_code=404, detail="User skill not found.")
    return {"message": "Skill removed."}
