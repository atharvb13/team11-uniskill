const umassEmailRegex = /^[a-zA-Z0-9._%+-]+@umass\.edu$/i;
const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;

export function normalizeEmail(email) {
  return (email ?? "").trim().toLowerCase();
}

export function validatePassword(password) {
  const value = password ?? "";
  const checks = {
    minLength: value.length >= 8,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /\d/.test(value),
  };

  const isValid = Object.values(checks).every(Boolean);
  return { isValid, checks };
}

export function validateRegistrationInput(payload) {
  const firstName = (payload.firstName ?? "").trim();
  const lastName = (payload.lastName ?? "").trim();
  const username = (payload.username ?? "").trim().toLowerCase();
  const email = normalizeEmail(payload.email);
  const password = payload.password ?? "";

  if (!firstName) {
    return { ok: false, message: "First name is required." };
  }

  if (!lastName) {
    return { ok: false, message: "Last name is required." };
  }

  if (!username || !usernameRegex.test(username)) {
    return {
      ok: false,
      message: "Username must be 3-30 characters and contain only letters, numbers, or underscores.",
    };
  }

  if (!email || !umassEmailRegex.test(email)) {
    return { ok: false, message: "Use a valid @umass.edu email address." };
  }

  const passwordResult = validatePassword(password);
  if (!passwordResult.isValid) {
    return {
      ok: false,
      message:
        "Password must be at least 8 characters and include uppercase, lowercase, and a number.",
    };
  }

  return { ok: true, firstName, lastName, username, email, password };
}

export function validateLoginInput(payload) {
  const raw = (payload.identifier ?? payload.email ?? "").trim();
  const password = payload.password ?? "";

  if (!raw) {
    return { ok: false, message: "Enter your UMass email or username." };
  }

  if (!password) {
    return { ok: false, message: "Password is required." };
  }

  if (raw.includes("@")) {
    const email = normalizeEmail(raw);
    if (!email || !umassEmailRegex.test(email)) {
      return { ok: false, message: "Use a valid @umass.edu email address." };
    }
    return { ok: true, mode: "email", email, password };
  }

  const username = raw.toLowerCase();
  if (!usernameRegex.test(username)) {
    return {
      ok: false,
      message: "Username must be 3-30 characters (letters, numbers, underscore).",
    };
  }

  return { ok: true, mode: "username", username, password };
}
