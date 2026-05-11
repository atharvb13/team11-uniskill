from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError
from pydantic import BaseModel

from app.dependencies import get_current_user_id, get_optional_user_id
from app.routes.reviews import build_teaching_reviews_payload
from app.supabase_clients import supabase_admin_client

_PROFILE_SELECT = (
    "id, username, first_name, last_name, contact_email, bio, "
    "date_of_joining, profile_picture_url, created_at, updated_at, "
    "program, degree_type, linkedin_url, github_url, portfolio_url"
)
_PUBLIC_SELECT = (
    "id, username, first_name, last_name, bio, date_of_joining, profile_picture_url, "
    "program, degree_type, linkedin_url, github_url, portfolio_url"
)
_DISCOVER_USER_SELECT = "id, username, first_name, last_name, bio"
_DISCOVER_SKILL_SELECT = (
    "user_id, can_teach, wants_to_learn, proficiency_level, skills(name, category)"
)
_RECOMMEND_SKILL_SELECT = (
    "user_id, can_teach, wants_to_learn, proficiency_level, skills(name, category)"
)
_PROFICIENCY_RANK = {
    "beginner": 1,
    "intermediate": 2,
    "advanced": 3,
    "expert": 4,
}
_RANK_TO_LEVEL = {v: k for k, v in _PROFICIENCY_RANK.items()}

router = APIRouter()


class UpdateProfileBody(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    bio: str | None = None
    profile_picture_url: str | None = None
    program: str | None = None
    degree_type: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None


def _proficiency_rank(value: str | None) -> int:
    if not value:
        return 0
    return _PROFICIENCY_RANK.get(str(value).strip().lower(), 0)


def _extract_skill(row: dict[str, Any]) -> dict[str, Any] | None:
    skill_data = row.get("skills")
    skill = skill_data[0] if isinstance(skill_data, list) else skill_data
    if not isinstance(skill, dict):
        return None

    name = skill.get("name")
    if not isinstance(name, str) or not name.strip():
        return None

    return {
        "name": name.strip(),
        "category": skill.get("category"),
    }


@router.get("/me")
def get_profile(user_id: str = Depends(get_current_user_id)) -> Any:
    try:
        rows = (
            supabase_admin_client.table("users")
            .select(_PROFILE_SELECT)
            .eq("id", user_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not rows:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return rows[0]


@router.patch("/me")
def update_profile(
    body: UpdateProfileBody,
    user_id: str = Depends(get_current_user_id),
) -> Any:
    raw = body.model_dump()
    updates: dict[str, Any] = {}
    _strip_fields = {"first_name", "last_name", "bio", "program", "degree_type",
                     "linkedin_url", "github_url", "portfolio_url", "profile_picture_url"}
    for k, v in raw.items():
        if v is None:
            continue
        if k in _strip_fields:
            stripped = str(v).strip() if isinstance(v, str) else v
            updates[k] = stripped if stripped else None
            if updates[k] is None:
                del updates[k]
            continue
        updates[k] = v

    if not updates:
        return JSONResponse(status_code=400, content={"error": "No fields to update."})

    try:
        supabase_admin_client.table("users").update(updates).eq("id", user_id).execute()
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"message": "Profile updated successfully."}


@router.get("/discover")
def discover_profiles(user_id: str = Depends(get_current_user_id)) -> Any:
    """List other users and their skills for dashboard discovery/search."""
    try:
        users = (
            supabase_admin_client.table("users")
            .select(_DISCOVER_USER_SELECT)
            .neq("id", user_id)
            .order("username")
            .execute()
            .data
            or []
        )
        rows = (
            supabase_admin_client.table("user_skills")
            .select(_DISCOVER_SKILL_SELECT)
            .neq("user_id", user_id)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    by_user: dict[str, dict[str, Any]] = {}
    for u in users:
        uid = str(u.get("id", ""))
        if not uid:
            continue
        by_user[uid] = {
            "id": uid,
            "username": u.get("username"),
            "first_name": u.get("first_name"),
            "last_name": u.get("last_name"),
            "bio": u.get("bio"),
            "teach_skills": [],
            "learn_skills": [],
        }

    for row in rows:
        uid = str(row.get("user_id", ""))
        target = by_user.get(uid)
        if not target:
            continue
        s = row.get("skills")
        skill = s[0] if isinstance(s, list) else s
        if not isinstance(skill, dict):
            continue
        skill_payload = {
            "name": skill.get("name"),
            "category": skill.get("category"),
            "proficiency_level": row.get("proficiency_level"),
        }
        if row.get("can_teach"):
            target["teach_skills"].append(skill_payload)
        if row.get("wants_to_learn"):
            target["learn_skills"].append(skill_payload)

    return list(by_user.values())


@router.get("/search")
def search_profiles(
    query: str = Query(..., min_length=1, max_length=80),
    limit: int = Query(20, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
) -> Any:
    """
    Search across all users by name/username and by skill name.
    Returns at most `limit` users with their teach/learn skills.
    """
    term = query.strip()
    if not term:
        return {"results": []}

    users_by_id: dict[str, dict[str, Any]] = {}

    try:
        for field in ("username", "first_name", "last_name"):
            rows = (
                supabase_admin_client.table("users")
                .select(_DISCOVER_USER_SELECT)
                .neq("id", user_id)
                .ilike(field, f"%{term}%")
                .limit(limit)
                .execute()
                .data
                or []
            )
            for row in rows:
                uid = str(row.get("id", ""))
                if not uid or uid in users_by_id:
                    continue
                users_by_id[uid] = row
                if len(users_by_id) >= limit:
                    break
            if len(users_by_id) >= limit:
                break

        matched_skill_rows = (
            supabase_admin_client.table("skills")
            .select("id")
            .ilike("name", f"%{term}%")
            .limit(limit)
            .execute()
            .data
            or []
        )
        matched_skill_ids = [str(row.get("id", "")) for row in matched_skill_rows if row.get("id")]

        if matched_skill_ids and len(users_by_id) < limit:
            user_skill_rows = (
                supabase_admin_client.table("user_skills")
                .select("user_id")
                .neq("user_id", user_id)
                .in_("skill_id", matched_skill_ids)
                .limit(limit * 5)
                .execute()
                .data
                or []
            )
            skill_user_ids: list[str] = []
            for row in user_skill_rows:
                uid = str(row.get("user_id", ""))
                if not uid or uid in users_by_id or uid in skill_user_ids:
                    continue
                skill_user_ids.append(uid)
                if len(users_by_id) + len(skill_user_ids) >= limit:
                    break

            if skill_user_ids:
                skill_users = (
                    supabase_admin_client.table("users")
                    .select(_DISCOVER_USER_SELECT)
                    .in_("id", skill_user_ids)
                    .execute()
                    .data
                    or []
                )
                for row in skill_users:
                    uid = str(row.get("id", ""))
                    if not uid or uid in users_by_id:
                        continue
                    users_by_id[uid] = row
                    if len(users_by_id) >= limit:
                        break
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    user_ids = list(users_by_id.keys())[:limit]
    if not user_ids:
        return {"results": []}

    try:
        user_skill_rows = (
            supabase_admin_client.table("user_skills")
            .select(_DISCOVER_SKILL_SELECT)
            .in_("user_id", user_ids)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    by_user: dict[str, dict[str, Any]] = {}
    for uid in user_ids:
        u = users_by_id.get(uid)
        if not u:
            continue
        by_user[uid] = {
            "id": uid,
            "username": u.get("username"),
            "first_name": u.get("first_name"),
            "last_name": u.get("last_name"),
            "bio": u.get("bio"),
            "teach_skills": [],
            "learn_skills": [],
        }

    for row in user_skill_rows:
        uid = str(row.get("user_id", ""))
        target = by_user.get(uid)
        if not target:
            continue
        s = row.get("skills")
        skill = s[0] if isinstance(s, list) else s
        if not isinstance(skill, dict):
            continue
        skill_payload = {
            "name": skill.get("name"),
            "category": skill.get("category"),
            "proficiency_level": row.get("proficiency_level"),
        }
        if row.get("can_teach"):
            target["teach_skills"].append(skill_payload)
        if row.get("wants_to_learn"):
            target["learn_skills"].append(skill_payload)

    return {"results": list(by_user.values())}


@router.get("/recommendations")
def get_recommendations(user_id: str = Depends(get_current_user_id)) -> Any:
    """
    Recommend users in two tiers:
    1) Mutual exchange: they can teach what I want to learn and I can teach what they want.
    2) One-way learning: they can teach what I want to learn, without a reciprocal match.
    """
    try:
        me_rows = (
            supabase_admin_client.table("user_skills")
            .select(_RECOMMEND_SKILL_SELECT)
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )
        others_rows = (
            supabase_admin_client.table("user_skills")
            .select(_RECOMMEND_SKILL_SELECT)
            .neq("user_id", user_id)
            .execute()
            .data
            or []
        )
        users = (
            supabase_admin_client.table("users")
            .select(_DISCOVER_USER_SELECT)
            .neq("id", user_id)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    my_wants_to_learn: dict[str, int] = {}
    my_can_teach: dict[str, int] = {}
    for row in me_rows:
        skill = _extract_skill(row)
        if not skill:
            continue
        key = str(skill["name"]).lower()
        rank = _proficiency_rank(row.get("proficiency_level"))
        if row.get("wants_to_learn"):
            my_wants_to_learn[key] = max(my_wants_to_learn.get(key, 0), rank)
        if row.get("can_teach"):
            my_can_teach[key] = max(my_can_teach.get(key, 0), rank)

    if not my_wants_to_learn:
        return {"recommendations": []}

    profiles_by_id: dict[str, dict[str, Any]] = {}
    for user in users:
        uid = str(user.get("id", ""))
        if not uid:
            continue
        profiles_by_id[uid] = {
            "id": uid,
            "username": user.get("username"),
            "first_name": user.get("first_name"),
            "last_name": user.get("last_name"),
            "bio": user.get("bio"),
        }

    skills_by_user: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in others_rows:
        uid = str(row.get("user_id", ""))
        if not uid:
            continue
        skill = _extract_skill(row)
        if not skill:
            continue
        skills_by_user[uid].append(
            {
                "name": skill["name"],
                "category": skill["category"],
                "can_teach": bool(row.get("can_teach")),
                "wants_to_learn": bool(row.get("wants_to_learn")),
                "rank": _proficiency_rank(row.get("proficiency_level")),
                "proficiency_level": row.get("proficiency_level"),
            }
        )

    tier_1: list[dict[str, Any]] = []
    tier_2: list[dict[str, Any]] = []

    for uid, candidate_skills in skills_by_user.items():
        profile = profiles_by_id.get(uid)
        if not profile:
            continue

        teach_matches: list[dict[str, Any]] = []
        reciprocal_matches: list[dict[str, Any]] = []

        for row in candidate_skills:
            skill_key = str(row["name"]).lower()
            candidate_rank = int(row["rank"])

            if row["can_teach"] and skill_key in my_wants_to_learn:
                my_rank = my_wants_to_learn[skill_key]
                if candidate_rank > my_rank:
                    teach_matches.append(
                        {
                            "skill_name": row["name"],
                            "category": row["category"],
                            "their_level": row["proficiency_level"],
                            "my_level": _RANK_TO_LEVEL.get(my_rank),
                            "level_gap": candidate_rank - my_rank,
                        }
                    )

            if row["wants_to_learn"] and skill_key in my_can_teach:
                my_rank = my_can_teach[skill_key]
                if my_rank > candidate_rank:
                    reciprocal_matches.append(
                        {
                            "skill_name": row["name"],
                            "category": row["category"],
                            "their_level": row["proficiency_level"],
                            "my_level": _RANK_TO_LEVEL.get(my_rank),
                            "level_gap": my_rank - candidate_rank,
                        }
                    )

        if not teach_matches:
            continue

        payload = {
            "user": profile,
            "teach_matches": sorted(
                teach_matches,
                key=lambda m: (int(m["level_gap"]), str(m["skill_name"]).lower()),
                reverse=True,
            ),
            "reciprocal_matches": sorted(
                reciprocal_matches,
                key=lambda m: (int(m["level_gap"]), str(m["skill_name"]).lower()),
                reverse=True,
            ),
        }

        if reciprocal_matches:
            payload["recommendation_tier"] = "mutual_exchange"
            tier_1.append(payload)
        else:
            payload["recommendation_tier"] = "one_way_learning"
            tier_2.append(payload)

    def _sort_key(item: dict[str, Any]) -> tuple[int, int, str]:
        teach_gap = sum(int(x.get("level_gap", 0)) for x in item["teach_matches"])
        reciprocal_gap = sum(int(x.get("level_gap", 0)) for x in item["reciprocal_matches"])
        username = str(item["user"].get("username") or "").lower()
        return (
            -(len(item["teach_matches"]) + len(item["reciprocal_matches"])),
            -(teach_gap + reciprocal_gap),
            username,
        )

    tier_1.sort(key=_sort_key)
    tier_2.sort(key=_sort_key)

    return {"recommendations": [*tier_1, *tier_2]}


@router.get("/{username}")
def get_public_profile(
    username: str,
    viewer_id: str | None = Depends(get_optional_user_id),
) -> Any:
    try:
        rows = (
            supabase_admin_client.table("users")
            .select(_PUBLIC_SELECT)
            .eq("username", username.lower())
            .limit(1)
            .execute()
            .data
            or []
        )
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not rows:
        raise HTTPException(status_code=404, detail="User not found.")

    profile = dict(rows[0])
    user_id = profile.pop("id", None)

    teach_skills: list[dict[str, Any]] = []
    learn_skills: list[dict[str, Any]] = []

    if user_id:
        try:
            skill_rows = (
                supabase_admin_client.table("user_skills")
                .select(_DISCOVER_SKILL_SELECT)
                .eq("user_id", user_id)
                .execute()
                .data
                or []
            )
        except APIError as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

        for row in skill_rows:
            s = row.get("skills")
            skill = s[0] if isinstance(s, list) else s
            if not isinstance(skill, dict):
                continue
            payload = {
                "name": skill.get("name"),
                "category": skill.get("category"),
                "proficiency_level": row.get("proficiency_level"),
            }
            if row.get("can_teach"):
                teach_skills.append(payload)
            if row.get("wants_to_learn"):
                learn_skills.append(payload)

    profile["teach_skills"] = teach_skills
    profile["learn_skills"] = learn_skills
    if user_id:
        profile["teaching_reviews"] = build_teaching_reviews_payload(str(user_id), viewer_id)
    else:
        profile["teaching_reviews"] = {
            "average_rating": None,
            "count": 0,
            "items": [],
            "eligible_to_review": False,
        }
    return profile
