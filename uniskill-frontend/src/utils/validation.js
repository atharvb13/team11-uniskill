export const umassEmailRegex = /^[a-zA-Z0-9._%+-]+@umass\.edu$/i;

export function validateLogin(values) {
  const errors = {};
  const email = values.email.trim();

  if (!email) {
    errors.email = "Email is required";
  } else if (!umassEmailRegex.test(email)) {
    errors.email = "Use your UMass email address ending in @umass.edu";
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

  if (!values.fullName.trim()) {
    errors.fullName = "Full name is required";
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