from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from app.dependencies import get_current_user_id
from app.supabase_clients import supabase_admin_client

router = APIRouter()


class TeachingReviewBody(BaseModel):
    teacher_username: str = Field(..., min_length=1, max_length=80)
    rating: int = Field(..., ge=1, le=5)
    body: str = Field(..., min_length=3, max_length=4000)


_REVIEWER_PUBLIC = "id, username, first_name, last_name"


def _username_key(raw: str) -> str:
    return raw.strip().lower()


def teacher_has_can_teach_skill(teacher_id: str) -> bool:
    try:
        rows = (
            supabase_admin_client.table("user_skills")
            .select("id")
            .eq("user_id", teacher_id)
            .eq("can_teach", True)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return bool(rows)


def had_completed_session(reviewer_id: str, teacher_id: str) -> bool:
    """True if the pair had a non-cancelled meeting whose end time is already past (session occurred)."""
    return reviewer_id in reviewer_ids_with_completed_session(teacher_id, [reviewer_id])


def reviewer_ids_with_completed_session(teacher_id: str, reviewer_ids: list[str]) -> set[str]:
    """Which reviewer_ids have had at least one completed scheduled meeting with teacher_id."""
    ids = [str(x) for x in reviewer_ids if x]
    if not ids:
        return set()
    now_iso = datetime.now(timezone.utc).isoformat()
    verified: set[str] = set()
    try:
        for other_col, teacher_col in (("participant_id", "organizer_id"), ("organizer_id", "participant_id")):
            hit = (
                supabase_admin_client.table("meetings")
                .select(other_col)
                .eq("status", "scheduled")
                .eq(teacher_col, teacher_id)
                .in_(other_col, ids)
                .lt("ends_at", now_iso)
                .execute()
                .data
                or []
            )
            for row in hit:
                uid = str(row.get(other_col) or "")
                if uid:
                    verified.add(uid)
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return verified


def build_teaching_reviews_payload(teacher_id: str, viewer_id: str | None) -> dict[str, Any]:
    """Public summary + recent reviews for a teacher profile."""
    eligible_to_review = False
    if viewer_id and str(viewer_id) != str(teacher_id):
        eligible_to_review = teacher_has_can_teach_skill(teacher_id) and had_completed_session(
            str(viewer_id), str(teacher_id)
        )

    try:
        rows = (
            supabase_admin_client.table("teacher_reviews")
            .select("id, rating, body, created_at, reviewer_id")
            .eq("teacher_id", teacher_id)
            .order("created_at", desc=True)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    reviewer_ids_for_badge = list({str(r["reviewer_id"]) for r in rows if r.get("reviewer_id")})
    session_verified_by_reviewer = reviewer_ids_with_completed_session(str(teacher_id), reviewer_ids_for_badge)

    count = len(rows)
    if count == 0:
        payload: dict[str, Any] = {
            "average_rating": None,
            "count": 0,
            "items": [],
            "eligible_to_review": eligible_to_review,
        }
        if viewer_id:
            payload["my_review"] = None
        return payload

    avg = sum(int(r["rating"]) for r in rows) / count
    display = rows[:50]
    reviewer_ids = list({str(r["reviewer_id"]) for r in display if r.get("reviewer_id")})

    reviewers_by_id: dict[str, dict[str, Any]] = {}
    if reviewer_ids:
        try:
            users = (
                supabase_admin_client.table("users")
                .select(_REVIEWER_PUBLIC)
                .in_("id", reviewer_ids)
                .execute()
                .data
                or []
            )
        except APIError as e:
            raise HTTPException(status_code=500, detail=str(e)) from e
        for u in users:
            uid = str(u.get("id", ""))
            if uid:
                reviewers_by_id[uid] = u

    items: list[dict[str, Any]] = []
    for r in display:
        rid = str(r.get("reviewer_id", ""))
        ru = reviewers_by_id.get(rid, {})
        items.append(
            {
                "id": r.get("id"),
                "rating": r.get("rating"),
                "body": r.get("body"),
                "created_at": r.get("created_at"),
                "session_verified": rid in session_verified_by_reviewer,
                "reviewer": {
                    "username": ru.get("username"),
                    "first_name": ru.get("first_name"),
                    "last_name": ru.get("last_name"),
                },
            }
        )

    out: dict[str, Any] = {
        "average_rating": round(avg, 1),
        "count": count,
        "items": items,
        "eligible_to_review": eligible_to_review,
    }

    if viewer_id:
        mine = next((r for r in rows if str(r.get("reviewer_id")) == viewer_id), None)
        if mine:
            out["my_review"] = {
                "id": mine.get("id"),
                "rating": mine.get("rating"),
                "body": mine.get("body"),
                "created_at": mine.get("created_at"),
                "session_verified": str(viewer_id) in session_verified_by_reviewer,
            }
        else:
            out["my_review"] = None

    return out


@router.post("")
def upsert_teaching_review(
    body: TeachingReviewBody,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    key = _username_key(body.teacher_username)
    if not key:
        raise HTTPException(status_code=400, detail="Invalid teacher username.")

    try:
        t_rows = (
            supabase_admin_client.table("users")
            .select("id")
            .eq("username", key)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not t_rows:
        raise HTTPException(status_code=404, detail="Teacher not found.")
    teacher_id = str(t_rows[0]["id"])
    if teacher_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot review your own profile.")

    if not teacher_has_can_teach_skill(teacher_id):
        raise HTTPException(
            status_code=400,
            detail="Reviews are only for members who offer at least one teaching skill.",
        )

    if not had_completed_session(user_id, teacher_id):
        raise HTTPException(
            status_code=403,
            detail="You can only leave a review after a completed meeting with this person on UniSkill (not cancelled, end time in the past).",
        )

    text = body.body.strip()
    if len(text) < 3:
        raise HTTPException(status_code=400, detail="Review text must be at least 3 characters.")

    try:
        existing = (
            supabase_admin_client.table("teacher_reviews")
            .select("id")
            .eq("reviewer_id", user_id)
            .eq("teacher_id", teacher_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    payload = {
        "rating": body.rating,
        "body": text,
    }

    try:
        if existing:
            supabase_admin_client.table("teacher_reviews").update(
                {
                    **payload,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", existing[0]["id"]).execute()
            review_id = existing[0]["id"]
        else:
            ins = (
                supabase_admin_client.table("teacher_reviews")
                .insert(
                    {
                        "reviewer_id": user_id,
                        "teacher_id": teacher_id,
                        **payload,
                    }
                )
                .execute()
                .data
                or []
            )
            review_id = ins[0]["id"] if ins else None
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"message": "Review saved.", "review_id": review_id}


@router.delete("/{review_id}", status_code=204)
def delete_teaching_review(review_id: str, user_id: str = Depends(get_current_user_id)) -> None:
    try:
        rows = (
            supabase_admin_client.table("teacher_reviews")
            .select("id, reviewer_id")
            .eq("id", review_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not rows:
        raise HTTPException(status_code=404, detail="Review not found.")
    if str(rows[0].get("reviewer_id")) != str(user_id):
        raise HTTPException(status_code=403, detail="You can only delete your own review.")

    try:
        supabase_admin_client.table("teacher_reviews").delete().eq("id", review_id).eq("reviewer_id", user_id).execute()
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
