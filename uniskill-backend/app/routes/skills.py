from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from postgrest.exceptions import APIError
from pydantic import BaseModel
from supabase_auth.errors import AuthApiError

from app.supabase_clients import supabase_admin_client, supabase_auth_client

router = APIRouter()
_bearer = HTTPBearer()

ProficiencyLevel = Literal["beginner", "intermediate", "advanced", "expert"]


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> str:
    token = credentials.credentials
    try:
        res = supabase_auth_client.auth.get_user(token)
        if not res.user or not res.user.id:
            raise HTTPException(status_code=401, detail="Invalid token.")
        return str(res.user.id)
    except AuthApiError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")


def clean_skill_name(name: str) -> str:
    """Normalize a skill name: strip, collapse spaces, title-case each word."""
    return " ".join(word.capitalize() for word in name.strip().split())


class AddUserSkillBody(BaseModel):
    skill_name: str
    category: str | None = None
    proficiency_level: ProficiencyLevel | None = None
    can_teach: bool = False
    wants_to_learn: bool = False


class UpdateUserSkillBody(BaseModel):
    proficiency_level: ProficiencyLevel | None = None
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
        raise HTTPException(status_code=500, detail=str(e))
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
            .select("id, skill_id, proficiency_level, can_teach, wants_to_learn, created_at, skills(name, category)")
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return rows


@router.post("/me", status_code=201)
def add_my_skill(
    body: AddUserSkillBody,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """Add a skill to the logged-in user's profile. Creates the skill if it doesn't exist."""
    name = clean_skill_name(body.skill_name)
    if not name:
        raise HTTPException(status_code=400, detail="skill_name cannot be empty.")

    # Find existing skill by name (case-insensitive)
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
        # Create the skill
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
            raise HTTPException(status_code=500, detail=str(e))
        skill_id = inserted[0]["id"]
        created_skill = True

    # Upsert into user_skills
    payload: dict[str, Any] = {
        "user_id": user_id,
        "skill_id": skill_id,
        "can_teach": body.can_teach,
        "wants_to_learn": body.wants_to_learn,
    }
    if body.proficiency_level is not None:
        payload["proficiency_level"] = body.proficiency_level

    try:
        result = (
            supabase_admin_client.table("user_skills")
            .upsert(payload, on_conflict="user_id,skill_id")
            .execute()
            .data
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    """Update proficiency/flags for one of the logged-in user's skills."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

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
        raise HTTPException(status_code=500, detail=str(e))

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
        raise HTTPException(status_code=500, detail=str(e))

    if not result:
        raise HTTPException(status_code=404, detail="User skill not found.")
    return {"message": "Skill removed."}
