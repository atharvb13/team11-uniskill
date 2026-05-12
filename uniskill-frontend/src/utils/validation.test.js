import { describe, expect, it } from "vitest";

import {
  mapLoginServerError,
  mapRegisterServerError,
  validateLogin,
  validateRegister,
} from "./validation.js";

describe("validation utilities", () => {
  it("validateRegister accepts a valid payload", () => {
    const errors = validateRegister({
      firstName: "Jane",
      lastName: "Doe",
      username: "jane_doe",
      email: "jane@umass.edu",
      password: "StrongPass1",
      confirmPassword: "StrongPass1",
    });
    expect(errors).toEqual({});
  });

  it("validateRegister rejects non-umass email", () => {
    const errors = validateRegister({
      firstName: "Jane",
      lastName: "Doe",
      username: "jane_doe",
      email: "jane@gmail.com",
      password: "StrongPass1",
      confirmPassword: "StrongPass1",
    });
    expect(errors.email).toBe("Only @umass.edu email addresses are allowed");
  });

  it("validateRegister reports required fields and weak password", () => {
    const errors = validateRegister({
      firstName: " ",
      lastName: "",
      username: "",
      email: "",
      password: "weak",
      confirmPassword: "",
    });

    expect(errors).toEqual({
      firstName: "First name is required",
      lastName: "Last name is required",
      username: "Username is required",
      email: "Email is required",
      password: "Password must be at least 8 characters",
      confirmPassword: "Please confirm your password",
    });
  });

  it("validateRegister rejects invalid username, missing password rules, and mismatched confirmation", () => {
    const errors = validateRegister({
      firstName: "Jane",
      lastName: "Doe",
      username: "jd!",
      email: "jane@umass.edu",
      password: "password",
      confirmPassword: "different",
    });

    expect(errors.username).toBe("Use 3-30 characters: letters, numbers, underscore");
    expect(errors.password).toBe("Password must include uppercase, lowercase, and a number");
    expect(errors.confirmPassword).toBe("Passwords do not match");
  });

  it("validateLogin accepts username identifier", () => {
    const errors = validateLogin({
      identifier: "jane_doe",
      password: "StrongPass1",
    });
    expect(errors).toEqual({});
  });

  it("validateLogin rejects bad email identifier", () => {
    const errors = validateLogin({
      identifier: "student@gmail.com",
      password: "StrongPass1",
    });
    expect(errors.identifier).toBe("Use your UMass email ending in @umass.edu");
  });

  it("validateLogin reports missing and short credentials", () => {
    expect(validateLogin({ identifier: "", password: "" })).toEqual({
      identifier: "Enter your UMass email or username",
      password: "Password is required",
    });
    expect(validateLogin({ identifier: "ab", password: "12345" })).toEqual({
      identifier: "Username: 3-30 characters, letters, numbers, underscore",
      password: "Password must be at least 6 characters",
    });
  });

  it("mapRegisterServerError maps username field", () => {
    const mapped = mapRegisterServerError("Username is taken", { field: "username" });
    expect(mapped.fieldErrors).toEqual({ username: "Username is taken" });
    expect(mapped.generalError).toBe("");
  });

  it("mapRegisterServerError maps supported fields and falls back to general errors", () => {
    expect(mapRegisterServerError("First name required", { field: "first_name" }).fieldErrors).toEqual({
      firstName: "First name required",
    });
    expect(mapRegisterServerError("Last name required").fieldErrors).toEqual({
      lastName: "Last name required",
    });
    expect(mapRegisterServerError("Use @umass.edu").fieldErrors).toEqual({
      email: "Use @umass.edu",
    });
    expect(mapRegisterServerError("Password too weak", { field: "password" }).fieldErrors).toEqual({
      password: "Password too weak",
    });
    expect(mapRegisterServerError("Unexpected failure")).toEqual({
      fieldErrors: {},
      generalError: "Unexpected failure",
    });
  });

  it("mapLoginServerError maps password text fallback", () => {
    const mapped = mapLoginServerError("Password is incorrect");
    expect(mapped.fieldErrors).toEqual({ password: "Password is incorrect" });
    expect(mapped.generalError).toBe("");
  });

  it("mapLoginServerError maps identifier fields and unknown errors", () => {
    expect(mapLoginServerError("Unknown username", { field: "identifier" }).fieldErrors).toEqual({
      identifier: "Unknown username",
    });
    expect(mapLoginServerError("Email not found").fieldErrors).toEqual({
      identifier: "Email not found",
    });
    expect(mapLoginServerError("Try again later")).toEqual({
      fieldErrors: {},
      generalError: "Try again later",
    });
  });
});
