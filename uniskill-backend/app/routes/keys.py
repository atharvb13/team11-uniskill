"""
Public-key endpoint for E2E chat encryption.

Each user can upload their ECDH P-256 public key (base64 SPKI).
Anyone can read a user's public key so they can encrypt messages to them.
Private keys are NEVER handled by the server.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError
from pydantic import BaseModel

from app.dependencies import get_current_user_id
from app.supabase_clients import supabase_admin_client

router = APIRouter()


class UploadKeyBody(BaseModel):
    public_key: str  # base64-encoded SPKI public key


@router.post("/me")
def upload_my_public_key(
    body: UploadKeyBody,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """Store or update the current user's E2E public key (idempotent upsert)."""
    if not body.public_key or not body.public_key.strip():
        raise HTTPException(status_code=400, detail="public_key must not be empty.")

    try:
        supabase_admin_client.table("user_public_keys").upsert(
            {"user_id": user_id, "public_key": body.public_key.strip()},
            on_conflict="user_id",
        ).execute()
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"message": "Public key stored."}


@router.get("/{target_user_id}")
def get_public_key(
    target_user_id: str,
    _user_id: str = Depends(get_current_user_id),  # require auth
) -> Any:
    """
    Retrieve another user's E2E public key so you can encrypt messages to them.
    Returns 404 when the user has not yet uploaded a key.
    """
    try:
        rows = (
            supabase_admin_client.table("user_public_keys")
            .select("public_key")
            .eq("user_id", target_user_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="This user has not uploaded an E2E public key yet."
        )

    return {"public_key": rows[0]["public_key"]}
