import importlib
import sys

import pytest
from fastapi import HTTPException


def _prepare_supabase_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key-for-tests")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-for-tests")


def _reload_module(module_name: str):
    sys.modules.pop(module_name, None)
    sys.modules.pop("app.supabase_clients", None)
    return importlib.import_module(module_name)


def test_validate_skill_body_accepts_expert(monkeypatch: pytest.MonkeyPatch) -> None:
    _prepare_supabase_env(monkeypatch)
    skills = _reload_module("app.routes.skills")
    body = skills.AddUserSkillBody(
        skill_name="Python",
        can_teach=True,
        wants_to_learn=False,
        proficiency_level="expert",
    )

    skills._validate_skill_body(body)


def test_clean_skill_name_normalizes_spacing_and_case(monkeypatch: pytest.MonkeyPatch) -> None:
    _prepare_supabase_env(monkeypatch)
    skills = _reload_module("app.routes.skills")

    assert skills.clean_skill_name("  react   native  ") == "React Native"
    assert skills.clean_skill_name("   ") == ""


def test_validate_skill_body_requires_teach_level(monkeypatch: pytest.MonkeyPatch) -> None:
    _prepare_supabase_env(monkeypatch)
    skills = _reload_module("app.routes.skills")
    body = skills.AddUserSkillBody(
        skill_name="Python",
        can_teach=True,
        wants_to_learn=False,
        proficiency_level=None,
    )

    with pytest.raises(HTTPException) as exc:
        skills._validate_skill_body(body)
    assert exc.value.status_code == 400


def test_validate_skill_body_requires_learn_goal_level(monkeypatch: pytest.MonkeyPatch) -> None:
    _prepare_supabase_env(monkeypatch)
    skills = _reload_module("app.routes.skills")
    body = skills.AddUserSkillBody(
        skill_name="Python",
        can_teach=False,
        wants_to_learn=True,
        proficiency_level=None,
    )

    with pytest.raises(HTTPException) as exc:
        skills._validate_skill_body(body)
    assert exc.value.status_code == 400


def test_proficiency_rank_handles_known_levels(monkeypatch: pytest.MonkeyPatch) -> None:
    _prepare_supabase_env(monkeypatch)
    profile = _reload_module("app.routes.profile")

    assert profile._proficiency_rank("beginner") == 1
    assert profile._proficiency_rank("expert") == 4
    assert profile._proficiency_rank("EXPERT") == 4
    assert profile._proficiency_rank(None) == 0
    assert profile._proficiency_rank("unknown") == 0


def test_extract_skill_handles_list_and_dict(monkeypatch: pytest.MonkeyPatch) -> None:
    _prepare_supabase_env(monkeypatch)
    profile = _reload_module("app.routes.profile")

    from_list = profile._extract_skill({"skills": [{"name": "  React  ", "category": "Tech"}]})
    from_dict = profile._extract_skill({"skills": {"name": "Design", "category": "Art"}})

    assert from_list == {"name": "React", "category": "Tech"}
    assert from_dict == {"name": "Design", "category": "Art"}


def test_extract_skill_rejects_missing_or_blank_skill(monkeypatch: pytest.MonkeyPatch) -> None:
    _prepare_supabase_env(monkeypatch)
    profile = _reload_module("app.routes.profile")

    assert profile._extract_skill({"skills": None}) is None
    assert profile._extract_skill({"skills": {"name": "  "}}) is None
    assert profile._extract_skill({"skills": [{"category": "Tech"}]}) is None
