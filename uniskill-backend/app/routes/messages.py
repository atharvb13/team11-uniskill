from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from postgrest.exceptions import APIError
from pydantic import BaseModel

from app.dependencies import get_current_user_id
from app.supabase_clients import supabase_admin_client

router = APIRouter()

_MSG_SELECT = (
    "id, sender_id, receiver_id, content, created_at, read_at, "
    "attachment_url, attachment_type, attachment_name, attachment_size"
)


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
    content: str = ""
    attachment_url: str | None = None
    attachment_type: str | None = None   # 'image' | 'file'
    attachment_name: str | None = None
    attachment_size: int | None = None


@router.get("/previews")
def get_message_previews(user_id: str = Depends(get_current_user_id)) -> Any:
    """
    Returns last message + unread count for each accepted connection.
    Used to build the WhatsApp-style conversations list.
    """
    # Step 1: get connected user IDs
    try:
        conn_rows = (
            supabase_admin_client.table("connections")
            .select("requester_id, receiver_id")
            .eq("status", "accepted")
            .or_(f"requester_id.eq.{user_id},receiver_id.eq.{user_id}")
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    connected_ids = [
        row["receiver_id"] if row["requester_id"] == user_id else row["requester_id"]
        for row in conn_rows
    ]
    if not connected_ids:
        return {"previews": []}

    # Step 2: fetch recent messages involving current user with connected users
    ids_str = ",".join(connected_ids)
    try:
        msgs = (
            supabase_admin_client.table("messages")
            .select(_MSG_SELECT)
            .or_(
                f"and(sender_id.eq.{user_id},receiver_id.in.({ids_str}))"
                f",and(receiver_id.eq.{user_id},sender_id.in.({ids_str}))"
            )
            .order("created_at", desc=True)
            .limit(500)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    # Step 3: group by conversation — take latest message + count unreads
    convos: dict[str, dict[str, Any]] = {}
    for msg in msgs:
        other = msg["receiver_id"] if msg["sender_id"] == user_id else msg["sender_id"]
        if other not in convos:
            convos[other] = {
                "other_user_id": other,
                "last_message": {
                    "content": msg["content"],
                    "created_at": msg["created_at"],
                    "sender_id": msg["sender_id"],
                    "attachment_type": msg.get("attachment_type"),
                    "attachment_name": msg.get("attachment_name"),
                },
                "unread_count": 0,
            }
        # Count unread: messages received by me that haven't been read
        if msg["receiver_id"] == user_id and not msg.get("read_at"):
            convos[other]["unread_count"] += 1

    return {"previews": list(convos.values())}


@router.patch("/{other_user_id}/read")
def mark_messages_read(
    other_user_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """Mark all unread messages from other_user_id to current user as read."""
    now = datetime.now(timezone.utc).isoformat()
    try:
        supabase_admin_client.table("messages").update({
            "read_at": now,
        }).eq("sender_id", other_user_id).eq("receiver_id", user_id).is_("read_at", "null").execute()
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"message": "Marked as read."}


@router.get("/{other_user_id}")
def get_messages(
    other_user_id: str,
    limit: int = Query(100, ge=1, le=500),
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """Retrieve message history between current user and another connected user."""
    _verify_connected(user_id, other_user_id)

    try:
        rows = (
            supabase_admin_client.table("messages")
            .select(_MSG_SELECT)
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
    """Send a message (with optional file/image attachment) to a connected user."""
    content = body.content.strip()
    has_attachment = bool(body.attachment_url)

    if not content and not has_attachment:
        raise HTTPException(status_code=400, detail="Message must have content or an attachment.")
    if content and len(content) > 2000:
        raise HTTPException(status_code=400, detail="Message is too long (max 2000 characters).")

    _verify_connected(user_id, other_user_id)

    payload: dict[str, Any] = {
        "sender_id": user_id,
        "receiver_id": other_user_id,
        "content": content,
    }
    if has_attachment:
        payload["attachment_url"] = body.attachment_url
        payload["attachment_type"] = body.attachment_type
        payload["attachment_name"] = body.attachment_name
        payload["attachment_size"] = body.attachment_size

    try:
        result = (
            supabase_admin_client.table("messages")
            .insert(payload)
            .execute()
            .data
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"message": result[0] if result else {}}
