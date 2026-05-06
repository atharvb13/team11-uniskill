from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from postgrest.exceptions import APIError
from pydantic import BaseModel
from supabase_auth.errors import AuthApiError

from app.supabase_clients import supabase_admin_client, supabase_auth_client

router = APIRouter()
_bearer = HTTPBearer()


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
        raise HTTPException(status_code=503, detail="Auth service temporarily unavailable. Please retry.")


def _verify_connected(user_id: str, other_user_id: str) -> None:
    """Raise 403 if the two users do not have an accepted connection."""
    try:
        rows = (
            supabase_admin_client.table("connections")
            .select("id")
            .eq("status", "accepted")
            .or_(
                f"and(requester_id.eq.{user_id},receiver_id.eq.{other_user_id})"
                f",and(requester_id.eq.{other_user_id},receiver_id.eq.{user_id})"
            )
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not rows:
        raise HTTPException(status_code=403, detail="You are not connected with this user.")


class SendMessageBody(BaseModel):
    content: str


@router.get("/{other_user_id}")
def get_messages(
    other_user_id: str,
    limit: int = Query(100, ge=1, le=500),
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """
    Retrieve the message history between the current user and another user.
    Both users must be connected.
    """
    _verify_connected(user_id, other_user_id)

    try:
        rows = (
            supabase_admin_client.table("messages")
            .select("id, sender_id, receiver_id, content, created_at, read_at")
            .or_(
                f"and(sender_id.eq.{user_id},receiver_id.eq.{other_user_id})"
                f",and(sender_id.eq.{other_user_id},receiver_id.eq.{user_id})"
            )
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"messages": rows}


@router.post("/{other_user_id}")
def send_message(
    other_user_id: str,
    body: SendMessageBody,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """
    Send a message to a connected user.
    """
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")
    if len(content) > 2000:
        raise HTTPException(status_code=400, detail="Message is too long (max 2000 characters).")

    _verify_connected(user_id, other_user_id)

    try:
        result = (
            supabase_admin_client.table("messages")
            .insert({
                "sender_id": user_id,
                "receiver_id": other_user_id,
                "content": content,
            })
            .execute()
            .data
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"message": result[0] if result else {}}
