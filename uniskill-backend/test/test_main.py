import importlib
import sys

import pytest
from fastapi.testclient import TestClient


def test_health_endpoint_returns_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key-for-tests")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-for-tests")
    sys.modules.pop("app.main", None)
    sys.modules.pop("app.supabase_clients", None)
    main = importlib.import_module("app.main")

    client = TestClient(main.app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
