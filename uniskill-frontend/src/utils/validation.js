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
  }

  if (!values.confirmPassword.trim()) {
    errors.confirmPassword = "Please confirm your password";
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return errors;
}