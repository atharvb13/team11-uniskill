from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError
from pydantic import BaseModel

from app.dependencies import get_current_user_id
from app.supabase_clients import supabase_admin_client

router = APIRouter()


class ConnectionRequestBody(BaseModel):
    receiver_id: str


@router.post("/request")
def send_connection_request(
    body: ConnectionRequestBody,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """Send a connection request to another user."""
    if body.receiver_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot connect with yourself.")

    # Check if a connection already exists in either direction
    try:
        existing = (
            supabase_admin_client.table("connections")
            .select("id, status")
            .or_(
                f"and(requester_id.eq.{user_id},receiver_id.eq.{body.receiver_id})"
                f",and(requester_id.eq.{body.receiver_id},receiver_id.eq.{user_id})"
            )
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if existing:
        conn = existing[0]
        if conn["status"] == "accepted":
            raise HTTPException(status_code=409, detail="Already connected.")
        if conn["status"] == "pending":
            raise HTTPException(status_code=409, detail="Connection request already pending.")
        # If rejected, allow re-requesting by updating status back to pending
        try:
            supabase_admin_client.table("connections").update({
                "status": "pending",
                "requester_id": user_id,
                "receiver_id": body.receiver_id,
            }).eq("id", conn["id"]).execute()
        except APIError as e:
            raise HTTPException(status_code=500, detail=str(e)) from e
        return {"message": "Connection request sent."}

    try:
        result = (
            supabase_admin_client.table("connections")
            .insert({
                "requester_id": user_id,
                "receiver_id": body.receiver_id,
                "status": "pending",
            })
            .execute()
            .data
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"message": "Connection request sent.", "connection": result[0] if result else {}}


@router.get("")
def get_my_connections(user_id: str = Depends(get_current_user_id)) -> Any:
    """Get all accepted connections with the other user's details."""
    try:
        rows = (
            supabase_admin_client.table("connections")
            .select("id, requester_id, receiver_id, status, created_at")
            .eq("status", "accepted")
            .or_(f"requester_id.eq.{user_id},receiver_id.eq.{user_id}")
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    other_ids = []
    conn_map: dict[str, str] = {}
    for row in rows:
        other_id = row["receiver_id"] if row["requester_id"] == user_id else row["requester_id"]
        other_ids.append(other_id)
        conn_map[other_id] = row["id"]

    if not other_ids:
        return {"connections": []}

    try:
        users = (
            supabase_admin_client.table("users")
            .select("id, username, first_name, last_name, bio, profile_picture_url")
            .in_("id", other_ids)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    result = []
    for u in users:
        uid = str(u["id"])
        result.append({
            "connection_id": conn_map.get(uid),
            "user": u,
        })

    return {"connections": result}


@router.get("/pending")
def get_pending_requests(user_id: str = Depends(get_current_user_id)) -> Any:
    """Get pending connection requests received by the current user."""
    try:
        rows = (
            supabase_admin_client.table("connections")
            .select("id, requester_id, created_at")
            .eq("receiver_id", user_id)
            .eq("status", "pending")
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    requester_ids = [row["requester_id"] for row in rows]
    if not requester_ids:
        return {"requests": []}

    try:
        users = (
            supabase_admin_client.table("users")
            .select("id, username, first_name, last_name, bio")
            .in_("id", requester_ids)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    user_map = {str(u["id"]): u for u in users}
    result = []
    for row in rows:
        u = user_map.get(str(row["requester_id"]))
        if u:
            result.append({
                "connection_id": row["id"],
                "user": u,
                "created_at": row["created_at"],
            })

    return {"requests": result}


@router.get("/sent")
def get_sent_requests(user_id: str = Depends(get_current_user_id)) -> Any:
    """Get pending connection requests sent by the current user."""
    try:
        rows = (
            supabase_admin_client.table("connections")
            .select("id, receiver_id, status, created_at")
            .eq("requester_id", user_id)
            .eq("status", "pending")
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"sent_requests": rows}


@router.post("/{connection_id}/accept")
def accept_connection(
    connection_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """Accept a pending connection request."""
    try:
        rows = (
            supabase_admin_client.table("connections")
            .select("id, receiver_id, status")
            .eq("id", connection_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not rows:
        raise HTTPException(status_code=404, detail="Connection request not found.")

    conn = rows[0]
    if conn["receiver_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to accept this request.")
    if conn["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending.")

    try:
        supabase_admin_client.table("connections").update({
            "status": "accepted",
        }).eq("id", connection_id).execute()
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"message": "Connection accepted."}


@router.post("/{connection_id}/reject")
def reject_connection(
    connection_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """Reject a pending connection request."""
    try:
        rows = (
            supabase_admin_client.table("connections")
            .select("id, receiver_id, status")
            .eq("id", connection_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not rows:
        raise HTTPException(status_code=404, detail="Connection request not found.")

    conn = rows[0]
    if conn["receiver_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to reject this request.")

    try:
        supabase_admin_client.table("connections").update({
            "status": "rejected",
        }).eq("id", connection_id).execute()
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"message": "Connection rejected."}


@router.get("/status/{target_user_id}")
def get_connection_status(
    target_user_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """Return the connection status between the current user and target_user_id.

    Returns: { status: 'none' | 'pending' | 'accepted', connection_id, i_am_requester }
    """
    if target_user_id == user_id:
        return {"status": "self", "connection_id": None, "i_am_requester": False}

    try:
        rows = (
            supabase_admin_client.table("connections")
            .select("id, status, requester_id, receiver_id")
            .or_(
                f"and(requester_id.eq.{user_id},receiver_id.eq.{target_user_id})"
                f",and(requester_id.eq.{target_user_id},receiver_id.eq.{user_id})"
            )
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not rows:
        return {"status": "none", "connection_id": None, "i_am_requester": False}

    conn = rows[0]
    return {
        "status": conn["status"],
        "connection_id": conn["id"],
        "i_am_requester": conn["requester_id"] == user_id,
    }
