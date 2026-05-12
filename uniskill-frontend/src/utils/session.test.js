import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  hasActiveSession,
  saveSession,
  saveSupabaseSession,
} from "./session.js";

function installLocalStorageMock() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => store.set(key, String(value))),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
  };
}

describe("session utilities", () => {
  beforeEach(() => {
    installLocalStorageMock();
    vi.restoreAllMocks();
  });

  it("saveSession stores access token, refresh token, and expiration", () => {
    saveSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: 2000000000,
    });

    expect(getAccessToken()).toBe("access-token");
    expect(getRefreshToken()).toBe("refresh-token");
    expect(localStorage.getItem("uniskill_session_expires_at")).toBe("2000000000");
  });

  it("saveSession removes missing values", () => {
    saveSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: 2000000000,
    });

    saveSession({});

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(localStorage.getItem("uniskill_session_expires_at")).toBeNull();
  });

  it("saveSupabaseSession maps Supabase token names", () => {
    saveSupabaseSession({
      access_token: "supabase-access",
      refresh_token: "supabase-refresh",
      expires_at: 2000000000,
    });

    expect(getAccessToken()).toBe("supabase-access");
    expect(getRefreshToken()).toBe("supabase-refresh");
  });

  it("clearSession removes all stored values", () => {
    saveSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: 2000000000,
    });

    clearSession();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(localStorage.getItem("uniskill_session_expires_at")).toBeNull();
  });

  it("hasActiveSession handles missing, active, expired, and malformed expiration values", () => {
    expect(hasActiveSession()).toBe(false);

    saveSession({ accessToken: "access-token" });
    expect(hasActiveSession()).toBe(true);

    localStorage.setItem("uniskill_session_expires_at", "not-a-number");
    expect(hasActiveSession()).toBe(true);

    const nowSeconds = 1000;
    vi.spyOn(Date, "now").mockReturnValue(nowSeconds * 1000);
    localStorage.setItem("uniskill_session_expires_at", String(nowSeconds + 120));
    expect(hasActiveSession()).toBe(true);

    localStorage.setItem("uniskill_session_expires_at", String(nowSeconds + 20));
    expect(hasActiveSession()).toBe(false);
  });
});
