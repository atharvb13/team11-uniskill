from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from app.dependencies import get_current_user_id
from app.supabase_clients import supabase_admin_client

router = APIRouter()

_MEETING_SELECT = (
    "id, organizer_id, participant_id, title, notes, starts_at, ends_at, status, created_at"
)


def _parse_iso(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _assert_connected(uid: str, other_id: str) -> None:
    if uid == other_id:
        raise HTTPException(status_code=400, detail="Cannot schedule with yourself.")
    try:
        rows = (
            supabase_admin_client.table("connections")
            .select("id")
            .eq("status", "accepted")
            .or_(
                f"and(requester_id.eq.{uid},receiver_id.eq.{other_id})"
                f",and(requester_id.eq.{other_id},receiver_id.eq.{uid})"
            )
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not rows:
        raise HTTPException(status_code=403, detail="You must be connected to schedule with this person.")


class CreateMeetingBody(BaseModel):
    participant_id: str = Field(description="Other user — must have an accepted connection")
    starts_at: datetime
    ends_at: datetime
    title: str | None = "Meeting"
    notes: str | None = None


def _overlap_range(rows: list[dict[str, Any]], range_start: datetime | None, range_end: datetime | None) -> list[dict[str, Any]]:
    if range_start is None or range_end is None:
        return rows
    rs = _parse_iso(range_start)
    re = _parse_iso(range_end)
    out = []
    for r in rows:
        try:
            sa = datetime.fromisoformat(str(r["starts_at"]).replace("Z", "+00:00"))
            ea = datetime.fromisoformat(str(r["ends_at"]).replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue
        if sa < re and ea > rs:
            out.append(r)
    return out


@router.get("")
def list_my_meetings(
    user_id: str = Depends(get_current_user_id),
    range_start: datetime | None = Query(None, alias="from"),
    range_end: datetime | None = Query(None, alias="to"),
) -> Any:
    """Meetings you are in (as organizer or participant). Optional `from` / `to` ISO datetimes filter overlapping range."""
    try:
        rows = (
            supabase_admin_client.table("meetings")
            .select(_MEETING_SELECT)
            .eq("status", "scheduled")
            .or_(f"organizer_id.eq.{user_id},participant_id.eq.{user_id}")
            .order("starts_at")
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    rows = _overlap_range(rows, range_start, range_end)

    other_ids = list({r["organizer_id"] if r["participant_id"] == user_id else r["participant_id"] for r in rows})
    user_map: dict[str, dict[str, Any]] = {}
    if other_ids:
        try:
            users = (
                supabase_admin_client.table("users")
                .select("id, username, first_name, last_name")
                .in_("id", other_ids)
                .execute()
                .data
                or []
            )
            user_map = {str(u["id"]): u for u in users}
        except APIError:
            pass

    out = []
    for r in rows:
        oid = str(r["organizer_id"])
        pid = str(r["participant_id"])
        other = oid if pid == user_id else pid
        role = "organizer" if oid == user_id else "participant"
        other_u = user_map.get(other, {})
        out.append({
            **r,
            "my_role": role,
            "other_user": {"id": other, **{k: other_u[k] for k in ("username", "first_name", "last_name") if k in other_u}},
        })
    return {"meetings": out}


@router.post("", status_code=201)
def create_meeting(body: CreateMeetingBody, user_id: str = Depends(get_current_user_id)) -> Any:
    starts = _parse_iso(body.starts_at)
    ends = _parse_iso(body.ends_at)
    if ends <= starts:
        raise HTTPException(status_code=400, detail="ends_at must be after starts_at.")
    _assert_connected(user_id, body.participant_id)

    title = (body.title or "Meeting").strip() or "Meeting"
    notes = (body.notes or "").strip() or None

    row = {
        "organizer_id": user_id,
        "participant_id": body.participant_id,
        "title": title,
        "notes": notes,
        "starts_at": starts.isoformat(),
        "ends_at": ends.isoformat(),
        "status": "scheduled",
    }
    try:
        result = supabase_admin_client.table("meetings").insert(row).execute().data
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"message": "Meeting scheduled.", "meeting": result[0] if result else row}


@router.delete("/{meeting_id}", status_code=200)
def cancel_meeting(meeting_id: str, user_id: str = Depends(get_current_user_id)) -> Any:
    try:
        rows = (
            supabase_admin_client.table("meetings")
            .select("id, organizer_id, participant_id")
            .eq("id", meeting_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not rows:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    m = rows[0]
    if str(m["organizer_id"]) != user_id and str(m["participant_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not a participant in this meeting.")
    try:
        supabase_admin_client.table("meetings").delete().eq("id", meeting_id).execute()
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {"message": "Meeting cancelled."}
