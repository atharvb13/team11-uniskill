from app.utils.auth_env import is_auto_confirm_email_enabled


def test_auto_confirm_enabled_values(monkeypatch) -> None:
    for value in ("true", "TRUE", "1", "yes", "on"):
        monkeypatch.setenv("AUTO_CONFIRM_EMAIL", value)
        assert is_auto_confirm_email_enabled() is True


def test_auto_confirm_disabled_values(monkeypatch) -> None:
    for value in ("false", "0", "no", "off", ""):
        monkeypatch.setenv("AUTO_CONFIRM_EMAIL", value)
        assert is_auto_confirm_email_enabled() is False


def test_auto_confirm_defaults_to_false_when_unset(monkeypatch) -> None:
    monkeypatch.delenv("AUTO_CONFIRM_EMAIL", raising=False)
    assert is_auto_confirm_email_enabled() is False
