import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearLocalOnboarding,
  getLocalOnboardingData,
  hasCompletedLocalOnboarding,
  saveLocalOnboarding,
} from "./onboardingLocal.js";

function installLocalStorageMock() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => store.set(key, String(value))),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
  };
}

describe("local onboarding utilities", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  it("saves, reads, and clears local onboarding state", () => {
    expect(hasCompletedLocalOnboarding()).toBe(false);
    expect(getLocalOnboardingData()).toBeNull();

    saveLocalOnboarding({ skills: ["React"], goal: "teach" });

    expect(hasCompletedLocalOnboarding()).toBe(true);
    expect(getLocalOnboardingData()).toEqual({ skills: ["React"], goal: "teach" });

    clearLocalOnboarding();

    expect(hasCompletedLocalOnboarding()).toBe(false);
    expect(getLocalOnboardingData()).toBeNull();
  });

  it("returns null for malformed saved onboarding data", () => {
    localStorage.setItem("uniskill_onboarding_draft", "{broken json");

    expect(getLocalOnboardingData()).toBeNull();
  });

  it("treats localStorage failures as unavailable state", () => {
    globalThis.localStorage = {
      getItem: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
      setItem: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
      removeItem: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
    };

    expect(hasCompletedLocalOnboarding()).toBe(false);
    expect(getLocalOnboardingData()).toBeNull();

    expect(() => saveLocalOnboarding({ skills: [] })).not.toThrow();
    expect(() => clearLocalOnboarding()).not.toThrow();
  });
});
