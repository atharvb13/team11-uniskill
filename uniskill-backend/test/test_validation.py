from app.utils.validation import (
    is_umass_email,
    normalize_email,
    validate_login_input,
    validate_password,
    validate_registration_input,
)


def test_normalize_email_trims_and_lowercases() -> None:
    assert normalize_email("  Student@UMASS.EDU  ") == "student@umass.edu"


def test_is_umass_email_accepts_only_umass_domain() -> None:
    assert is_umass_email(" student@UMASS.EDU ") is True
    assert is_umass_email("student@cs.umass.edu") is False
    assert is_umass_email("student@gmail.com") is False


def test_validate_password_requires_all_rules() -> None:
    ok, checks = validate_password("Weakpass")
    assert ok is False
    assert checks["minLength"] is True
    assert checks["uppercase"] is True
    assert checks["lowercase"] is True
    assert checks["number"] is False


def test_validate_registration_input_success_normalizes_fields() -> None:
    result = validate_registration_input(
        {
            "firstName": " Jane ",
            "lastName": " Doe ",
            "username": "Jane_Doe",
            "email": " JDOE@UMASS.EDU ",
            "password": "StrongPass1",
        }
    )

    assert result["ok"] is True
    assert result["firstName"] == "Jane"
    assert result["lastName"] == "Doe"
    assert result["username"] == "jane_doe"
    assert result["email"] == "jdoe@umass.edu"


def test_validate_registration_input_rejects_non_umass_email() -> None:
    result = validate_registration_input(
        {
            "firstName": "Jane",
            "lastName": "Doe",
            "username": "janedoe",
            "email": "jane@gmail.com",
            "password": "StrongPass1",
        }
    )

    assert result == {"ok": False, "message": "Use a valid @umass.edu email address."}


def test_validate_registration_input_rejects_required_and_format_errors() -> None:
    base = {
        "firstName": "Jane",
        "lastName": "Doe",
        "username": "janedoe",
        "email": "jane@umass.edu",
        "password": "StrongPass1",
    }

    assert validate_registration_input({**base, "firstName": ""}) == {
        "ok": False,
        "message": "First name is required.",
    }
    assert validate_registration_input({**base, "lastName": " "}) == {
        "ok": False,
        "message": "Last name is required.",
    }
    assert validate_registration_input({**base, "username": "jd!"}) == {
        "ok": False,
        "message": "Username must be 3-30 characters and contain only letters, numbers, or underscores.",
    }
    assert validate_registration_input({**base, "password": "weak"}) == {
        "ok": False,
        "message": "Password must be at least 8 characters and include uppercase, lowercase, and a number.",
    }


def test_validate_login_input_accepts_email_identifier() -> None:
    result = validate_login_input({"identifier": " Student@umass.edu ", "password": "StrongPass1"})
    assert result["ok"] is True
    assert result["mode"] == "email"
    assert result["email"] == "student@umass.edu"


def test_validate_login_input_accepts_username_identifier() -> None:
    result = validate_login_input({"identifier": "Student_123", "password": "StrongPass1"})
    assert result["ok"] is True
    assert result["mode"] == "username"
    assert result["username"] == "student_123"


def test_validate_login_input_requires_password() -> None:
    result = validate_login_input({"identifier": "student_123", "password": ""})
    assert result == {"ok": False, "message": "Password is required."}


def test_validate_login_input_rejects_missing_and_invalid_identifier() -> None:
    assert validate_login_input({"identifier": "", "password": "StrongPass1"}) == {
        "ok": False,
        "message": "Enter your UMass email or username.",
    }
    assert validate_login_input({"identifier": "student@gmail.com", "password": "StrongPass1"}) == {
        "ok": False,
        "message": "Use a valid @umass.edu email address.",
    }
    assert validate_login_input({"identifier": "ab", "password": "StrongPass1"}) == {
        "ok": False,
        "message": "Username must be 3-30 characters (letters, numbers, underscore).",
    }
