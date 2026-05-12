const DONE_KEY = "uniskill_onboarding_complete";
const DATA_KEY = "uniskill_onboarding_draft";

export function hasCompletedLocalOnboarding() {
  try {
    return localStorage.getItem(DONE_KEY) === "true";
  } catch {
    return false;
  }
}

/** @param {object} payload */
export function saveLocalOnboarding(payload) {
  try {
    localStorage.setItem(DONE_KEY, "true");
    localStorage.setItem(DATA_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getLocalOnboardingData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Clears saved setup so the onboarding wizard can run again (browser only). */
export function clearLocalOnboarding() {
  try {
    localStorage.removeItem(DONE_KEY);
    localStorage.removeItem(DATA_KEY);
  } catch {
    /* ignore */
  }
}
