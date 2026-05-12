from types import SimpleNamespace
import os

import httpx
import pytest
from fastapi import HTTPException

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-key-for-tests")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-for-tests")

from app import dependencies


class _FakeSupabaseAuthClient:
    def __init__(self, results):
        self.auth = self
        self._results = list(results)

    def get_user(self, token: str):
        result = self._results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


def _credentials(token: str = "token") -> SimpleNamespace:
    return SimpleNamespace(credentials=token)


def _auth_response(user_id: str | None):
    user = SimpleNamespace(id=user_id) if user_id is not None else None
    return SimpleNamespace(user=user)


def test_get_current_user_id_returns_verified_user(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(dependencies, "supabase_auth_client", _FakeSupabaseAuthClient([_auth_response("user-1")]))

    assert dependencies.get_current_user_id(_credentials()) == "user-1"


def test_get_current_user_id_rejects_missing_user(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(dependencies, "supabase_auth_client", _FakeSupabaseAuthClient([_auth_response(None)]))

    with pytest.raises(HTTPException) as exc:
        dependencies.get_current_user_id(_credentials())

    assert exc.value.status_code == 401


def test_get_current_user_id_retries_transient_auth_http_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(dependencies.time, "sleep", lambda _: None)
    monkeypatch.setattr(
        dependencies,
        "supabase_auth_client",
        _FakeSupabaseAuthClient(
            [
                httpx.ConnectError("first failure"),
                httpx.ConnectError("second failure"),
                _auth_response("user-2"),
            ]
        ),
    )

    assert dependencies.get_current_user_id(_credentials()) == "user-2"


def test_get_current_user_id_returns_503_after_retries(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(dependencies.time, "sleep", lambda _: None)
    monkeypatch.setattr(
        dependencies,
        "supabase_auth_client",
        _FakeSupabaseAuthClient(
            [
                httpx.ConnectError("first failure"),
                httpx.ConnectError("second failure"),
                httpx.ConnectError("third failure"),
            ]
        ),
    )

    with pytest.raises(HTTPException) as exc:
        dependencies.get_current_user_id(_credentials())

    assert exc.value.status_code == 503


def test_get_optional_user_id_handles_absent_invalid_and_valid_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert dependencies.get_optional_user_id(None) is None
    assert dependencies.get_optional_user_id(SimpleNamespace(credentials="")) is None

    monkeypatch.setattr(dependencies, "supabase_auth_client", _FakeSupabaseAuthClient([_auth_response(None)]))
    assert dependencies.get_optional_user_id(_credentials()) is None

    monkeypatch.setattr(dependencies, "supabase_auth_client", _FakeSupabaseAuthClient([_auth_response("user-3")]))
    assert dependencies.get_optional_user_id(_credentials()) == "user-3"


def test_get_optional_user_id_suppresses_http_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        dependencies,
        "supabase_auth_client",
        _FakeSupabaseAuthClient([httpx.ConnectError("auth unavailable")]),
    )

    assert dependencies.get_optional_user_id(_credentials()) is None
