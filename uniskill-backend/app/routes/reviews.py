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


def build_teaching_reviews_payload(teacher_id: str, viewer_id: str | None) -> dict[str, Any]:
    """Public summary + recent reviews for a teacher profile."""
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

    count = len(rows)
    if count == 0:
        payload: dict[str, Any] = {
            "average_rating": None,
            "count": 0,
            "items": [],
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
    }

    if viewer_id:
        mine = next((r for r in rows if str(r.get("reviewer_id")) == viewer_id), None)
        if mine:
            out["my_review"] = {
                "id": mine.get("id"),
                "rating": mine.get("rating"),
                "body": mine.get("body"),
                "created_at": mine.get("created_at"),
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
