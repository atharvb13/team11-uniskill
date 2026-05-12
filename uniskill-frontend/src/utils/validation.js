export const umassEmailRegex = /^[a-zA-Z0-9._%+-]+@umass\.edu$/i;
const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;

export function validateLogin(values) {
  const errors = {};
  const raw = (values.identifier ?? "").trim();

  if (!raw) {
    errors.identifier = "Enter your UMass email or username";
  } else if (raw.includes("@")) {
    const email = raw.trim().toLowerCase();
    if (!umassEmailRegex.test(email)) {
      errors.identifier = "Use your UMass email ending in @umass.edu";
    }
  } else if (!usernameRegex.test(raw.trim().toLowerCase())) {
    errors.identifier = "Username: 3-30 characters, letters, numbers, underscore";
  }

  if (!values.password.trim()) {
    errors.password = "Password is required";
  } else if (values.password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  return errors;
}

export function validateRegister(values) {
  const errors = {};
  const email = values.email.trim();

  if (!values.firstName.trim()) {
    errors.firstName = "First name is required";
  }

  if (!values.lastName.trim()) {
    errors.lastName = "Last name is required";
  }

  if (!values.username.trim()) {
    errors.username = "Username is required";
  } else if (!usernameRegex.test(values.username.trim().toLowerCase())) {
    errors.username = "Use 3-30 characters: letters, numbers, underscore";
  }

  if (!email) {
    errors.email = "Email is required";
  } else if (!umassEmailRegex.test(email)) {
    errors.email = "Only @umass.edu email addresses are allowed";
  }

  if (!values.password.trim()) {
    errors.password = "Password is required";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  } else if (!/[A-Z]/.test(values.password) || !/[a-z]/.test(values.password) || !/[0-9]/.test(values.password)) {
    errors.password = "Password must include uppercase, lowercase, and a number";
  }

  if (!values.confirmPassword.trim()) {
    errors.confirmPassword = "Please confirm your password";
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return errors;
}

/**
 * Map backend auth/register errors to field-level frontend errors when possible.
 */
export function mapRegisterServerError(message, meta = {}) {
  const text = String(message || "");
  const lower = text.toLowerCase();
  const serverField = typeof meta?.field === "string" ? meta.field.toLowerCase() : "";

  if (serverField === "firstname" || serverField === "first_name") {
    return { fieldErrors: { firstName: text }, generalError: "" };
  }
  if (serverField === "lastname" || serverField === "last_name") {
    return { fieldErrors: { lastName: text }, generalError: "" };
  }
  if (serverField === "username") {
    return { fieldErrors: { username: text }, generalError: "" };
  }
  if (serverField === "email" || serverField === "contact_email") {
    return { fieldErrors: { email: text }, generalError: "" };
  }
  if (serverField === "password") {
    return { fieldErrors: { password: text }, generalError: "" };
  }

  if (lower.includes("first name")) {
    return { fieldErrors: { firstName: text }, generalError: "" };
  }
  if (lower.includes("last name")) {
    return { fieldErrors: { lastName: text }, generalError: "" };
  }
  if (lower.includes("username")) {
    return { fieldErrors: { username: text }, generalError: "" };
  }
  if (lower.includes("email") || lower.includes("@umass.edu")) {
    return { fieldErrors: { email: text }, generalError: "" };
  }
  if (lower.includes("password")) {
    return { fieldErrors: { password: text }, generalError: "" };
  }

  return { fieldErrors: {}, generalError: text };
}

/**
 * Map backend auth/login errors to field-level frontend errors when possible.
 */
export function mapLoginServerError(message, meta = {}) {
  const text = String(message || "");
  const lower = text.toLowerCase();
  const serverField = typeof meta?.field === "string" ? meta.field.toLowerCase() : "";

  if (serverField === "identifier" || serverField === "username" || serverField === "email") {
    return { fieldErrors: { identifier: text }, generalError: "" };
  }
  if (serverField === "password") {
    return { fieldErrors: { password: text }, generalError: "" };
  }

  if (lower.includes("email") || lower.includes("username") || lower.includes("identifier")) {
    return { fieldErrors: { identifier: text }, generalError: "" };
  }
  if (lower.includes("password")) {
    return { fieldErrors: { password: text }, generalError: "" };
  }

  return { fieldErrors: {}, generalError: text };
}