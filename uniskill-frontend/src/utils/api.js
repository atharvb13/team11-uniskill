import { getAccessToken } from "./session";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function errorMessageFromBody(json, fallback) {
  if (json?.error && typeof json.error === "string") {
    return json.error;
  }
  const d = json?.detail;
  if (typeof d === "string") {
    return d;
  }
  if (d && typeof d === "object" && !Array.isArray(d) && typeof d.message === "string") {
    return d.message;
  }
  if (Array.isArray(d)) {
    return d.map((x) => x.msg || x).join("; ") || fallback;
  }
  return fallback;
}

function attachStatus(err, status) {
  const e = err instanceof Error ? err : new Error(String(err));
  e.status = status;
  return e;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw attachStatus(new Error(text.slice(0, 200) || "Request failed."), response.status);
    }
  }
  if (!response.ok) {
    throw attachStatus(new Error(errorMessageFromBody(json, "Request failed.")), response.status);
  }
  return json;
}

async function sendRequest(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response);
}

/**
 * @param {string} path
 * @param {{ method?: string, body?: object }} [options]
 */
export async function authRequest(path, options = {}) {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Not signed in.");
  }

  const { method = "GET", body } = options;
  const headers = { Authorization: `Bearer ${token}` };
  if (body != null) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  return parseJsonResponse(response);
}

export async function registerUser(payload) {
  return sendRequest("/api/auth/register", payload);
}

export async function loginUser({ identifier, password }) {
  return sendRequest("/api/auth/login", { identifier, password });
}

/** @returns {Promise<object|null>} profile row or null if 404 */
export async function getMyProfile() {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Not signed in.");
  }

  const response = await fetch(`${API_BASE_URL}/api/profile/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 404) {
    return null;
  }

  return parseJsonResponse(response);
}

/**
 * @param {object} payload — snake_case: first_name, last_name, bio
 */
export async function updateMyProfile(payload) {
  return authRequest("/api/profile/me", { method: "PATCH", body: payload });
}

/** @returns {Promise<object[]>} */
export async function getMySkills() {
  return authRequest("/api/skills/me", { method: "GET" });
}

/**
 * @param {object} body — skill_name, category?, proficiency_level?, can_teach, wants_to_learn
 */
export async function addMySkill(body) {
  return authRequest("/api/skills/me", { method: "POST", body });
}

/** @param {string} skillId — UUID of the skill row in `skills`, same as `skill_id` on user_skills */
export async function removeMySkill(skillId) {
  return authRequest(`/api/skills/me/${encodeURIComponent(skillId)}`, { method: "DELETE" });
}

/**
 * @param {string} skillId
 * @param {object} body — proficiency_level, can_teach, wants_to_learn
 */
export async function updateMySkill(skillId, body) {
  return authRequest(`/api/skills/me/${encodeURIComponent(skillId)}`, { method: "PATCH", body });
}

/** Public catalogue — no auth */
export async function listCatalogSkills() {
  const response = await fetch(`${API_BASE_URL}/api/skills`);
  return parseJsonResponse(response);
}
