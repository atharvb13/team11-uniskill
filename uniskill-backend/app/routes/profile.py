from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from postgrest.exceptions import APIError
from pydantic import BaseModel
from supabase_auth.errors import AuthApiError

from app.supabase_clients import supabase_admin_client, supabase_auth_client

router = APIRouter()
_bearer = HTTPBearer()


DegreeType = Literal["bachelors", "masters", "phd"]


class UpdateProfileBody(BaseModel):
    bio: str | None = None
    program: str | None = None
    degree_type: DegreeType | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None
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
            .select(
                "id, username, first_name, last_name, contact_email, bio, program, "
                "degree_type, date_of_joining, linkedin_url, github_url, portfolio_url, "
                "profile_picture_url, created_at, updated_at"
            )
            .eq("id", user_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not rows:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return rows[0]


@router.patch("/me")
def update_profile(
    body: UpdateProfileBody,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return JSONResponse(status_code=400, content={"error": "No fields to update."})

    try:
        supabase_admin_client.table("users").update(updates).eq("id", user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")

    return {"message": "Profile updated successfully."}


@router.get("/{username}")
def get_public_profile(username: str) -> Any:
    try:
        rows = (
            supabase_admin_client.table("users")
            .select(
                "username, first_name, last_name, bio, program, degree_type, "
                "date_of_joining, linkedin_url, github_url, portfolio_url, profile_picture_url"
            )
            .eq("username", username.lower())
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not rows:
        raise HTTPException(status_code=404, detail="User not found.")
    return rows[0]
