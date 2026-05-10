const ACCESS_TOKEN_KEY = "uniskill_access_token";
const REFRESH_TOKEN_KEY = "uniskill_refresh_token";
const EXPIRES_AT_KEY = "uniskill_session_expires_at";

/**
 * @param {object|null|undefined} session - from /api/auth/login: { accessToken, refreshToken, expiresAt }
 */
export function saveSession(session) {
  if (session?.accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  if (session?.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  if (session?.expiresAt != null && session.expiresAt !== "") {
    localStorage.setItem(EXPIRES_AT_KEY, String(session.expiresAt));
  } else {
    localStorage.removeItem(EXPIRES_AT_KEY);
  }
}

export function saveSupabaseSession(session) {
  saveSession({
    accessToken: session?.access_token,
    refreshToken: session?.refresh_token,
    expiresAt: session?.expires_at,
  });
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * True when we have a non-expired access token (Supabase expires_at is unix seconds).
 */
export function hasActiveSession() {
  const token = getAccessToken();
  if (!token) {
    return false;
  }

  const raw = localStorage.getItem(EXPIRES_AT_KEY);
  if (!raw) {
    return true;
  }

  const expiresAtSec = Number.parseInt(raw, 10);
  if (Number.isNaN(expiresAtSec)) {
    return true;
  }

  const nowSec = Date.now() / 1000;
  return nowSec < expiresAtSec - 30;
}
