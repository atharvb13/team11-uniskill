"""
Shared FastAPI dependencies.

get_current_user_id — verifies the Bearer JWT with Supabase and returns the
caller's user-id string.  Retries up to 2 extra times on transient httpx
transport errors (common on the very first request after a cold-start because
the httpx connection pool hasn't warmed up yet).
"""

import time

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase_auth.errors import AuthApiError

from app.supabase_clients import supabase_auth_client

_bearer = HTTPBearer()
_optional_bearer = HTTPBearer(auto_error=False)

_MAX_RETRIES = 2          # total extra attempts after the first failure
_RETRY_DELAY = 0.4        # seconds between retries


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    token = credentials.credentials
    last_err: Exception | None = None

    for attempt in range(_MAX_RETRIES + 1):
        try:
            res = supabase_auth_client.auth.get_user(token)
            if not res.user or not res.user.id:
                raise HTTPException(status_code=401, detail="Invalid token.")
            return str(res.user.id)
        except AuthApiError:
            # Token is genuinely invalid — don't retry.
            raise HTTPException(status_code=401, detail="Invalid or expired token.")
        except httpx.HTTPError as exc:
            last_err = exc
            if attempt < _MAX_RETRIES:
                time.sleep(_RETRY_DELAY)
            # else fall through to raise below

    raise HTTPException(
        status_code=503,
        detail="Auth service temporarily unavailable. Please retry.",
    )


def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
) -> str | None:
    """Same verification as get_current_user_id, but returns None when no/invalid token."""
    if credentials is None or not getattr(credentials, "credentials", None):
        return None
    token = credentials.credentials
    try:
        res = supabase_auth_client.auth.get_user(token)
        if not res.user or not res.user.id:
            return None
        return str(res.user.id)
    except AuthApiError:
        return None
    except httpx.HTTPError:
        return None
