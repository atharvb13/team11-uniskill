from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError
from pydantic import BaseModel

from app.dependencies import get_current_user_id
from app.supabase_clients import supabase_admin_client

router = APIRouter()

_ALLOWED_FILE_TYPES = frozenset({"pdf", "video", "image"})


class AddWorkSampleBody(BaseModel):
    user_skill_id: str
    file_url: str
    file_type: str
    file_name: str | None = None
    file_size: int | None = None


@router.post("", status_code=201)
def add_work_sample(
    body: AddWorkSampleBody,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """Save work sample metadata after the file has been uploaded to Supabase Storage."""
    if body.file_type not in _ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="file_type must be one of: pdf, video, image.",
        )
    if not body.file_url.strip():
        raise HTTPException(status_code=400, detail="file_url cannot be empty.")

    # Verify the calling user owns this user_skill row
    try:
        skill_rows = (
            supabase_admin_client.table("user_skills")
            .select("id")
            .eq("id", body.user_skill_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not skill_rows:
        raise HTTPException(
            status_code=403,
            detail="You do not own this skill or it does not exist.",
        )

    try:
        result = (
            supabase_admin_client.table("work_samples")
            .insert(
                {
                    "user_skill_id": body.user_skill_id,
                    "file_url": body.file_url.strip(),
                    "file_type": body.file_type,
                    "file_name": body.file_name,
                    "file_size": body.file_size,
                }
            )
            .execute()
            .data
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {
        "message": "Work sample added.",
        "work_sample": result[0] if result else None,
    }


@router.get("/{user_skill_id}")
def get_work_samples(user_skill_id: str) -> Any:
    """Get all work samples for a given user_skill (publicly accessible)."""
    try:
        rows = (
            supabase_admin_client.table("work_samples")
            .select("id, file_url, file_type, file_name, file_size, created_at")
            .eq("user_skill_id", user_skill_id)
            .order("created_at")
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return rows


@router.delete("/{sample_id}", status_code=200)
def delete_work_sample(
    sample_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """Delete a work sample. Only the owning user may delete."""
    try:
        sample_rows = (
            supabase_admin_client.table("work_samples")
            .select("id, user_skill_id")
            .eq("id", sample_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not sample_rows:
        raise HTTPException(status_code=404, detail="Work sample not found.")

    user_skill_id = sample_rows[0]["user_skill_id"]

    try:
        skill_rows = (
            supabase_admin_client.table("user_skills")
            .select("id")
            .eq("id", user_skill_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not skill_rows:
        raise HTTPException(status_code=403, detail="You do not own this work sample.")

    try:
        supabase_admin_client.table("work_samples").delete().eq("id", sample_id).execute()
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"message": "Work sample removed."}
