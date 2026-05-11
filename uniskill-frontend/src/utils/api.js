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

function attachStatus(err, status, details) {
  const e = err instanceof Error ? err : new Error(String(err));
  e.status = status;
  if (details && typeof details === "object") {
    e.data = details;
    if (typeof details.field === "string") {
      e.field = details.field;
    }
    if (typeof details.code === "string") {
      e.code = details.code;
    }
  }
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
    throw attachStatus(new Error(errorMessageFromBody(json, "Request failed.")), response.status, json);
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

export async function syncGoogleSession(session) {
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Google sign-in did not return a session.");
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      refreshToken: session?.refresh_token ?? null,
      expiresAt: session?.expires_at ?? null,
    }),
  });

  return parseJsonResponse(response);
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

/**
 * @param {string} username
 * @returns {Promise<object>} public profile with teach_skills and learn_skills
 */
export async function getPublicProfile(username) {
  return authRequest(`/api/profile/${encodeURIComponent(username)}`, { method: "GET" });
}

// ─── Work Samples ─────────────────────────────────────────────────────────────

/**
 * Save work sample metadata after the file has been uploaded to Supabase Storage.
 * @param {{ user_skill_id: string, file_url: string, file_type: string, file_name?: string, file_size?: number }} payload
 */
export async function addWorkSample(payload) {
  return authRequest("/api/work-samples", { method: "POST", body: payload });
}

/**
 * Get all work samples for a given user_skill_id (public).
 * @param {string} userSkillId
 */
export async function getWorkSamples(userSkillId) {
  return authRequest(`/api/work-samples/${encodeURIComponent(userSkillId)}`, { method: "GET" });
}

/**
 * Delete a work sample by its ID.
 * @param {string} sampleId
 */
export async function deleteWorkSample(sampleId) {
  return authRequest(`/api/work-samples/${encodeURIComponent(sampleId)}`, { method: "DELETE" });
}

/**
 * Star rating + text for a member who teaches at least one skill (upsert per viewer).
 * @param {{ teacherUsername: string, rating: number, body: string }} payload
 */
export async function upsertTeachingReview(payload) {
  const { teacherUsername, rating, body } = payload;
  return authRequest("/api/reviews", {
    method: "POST",
    body: {
      teacher_username: teacherUsername,
      rating,
      body,
    },
  });
}

/** @param {string} reviewId — UUID of your review row */
export async function deleteTeachingReview(reviewId) {
  return authRequest(`/api/reviews/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
}

/** @returns {Promise<object[]>} Other users with teach/learn skills */
export async function discoverProfiles() {
  return authRequest("/api/profile/discover", { method: "GET" });
}

/** @returns {Promise<object[]>} Prioritized recommendations for dashboard home */
export async function getRecommendations() {
  const json = await authRequest("/api/profile/recommendations", { method: "GET" });
  return Array.isArray(json?.recommendations) ? json.recommendations : [];
}

/** @returns {Promise<object[]>} Search users by name or skill */
export async function searchProfiles(query, limit = 20) {
  const q = String(query || "").trim();
  if (!q) {
    return [];
  }
  const params = new URLSearchParams({
    query: q,
    limit: String(limit),
  });
  const json = await authRequest(`/api/profile/search?${params.toString()}`, { method: "GET" });
  return Array.isArray(json?.results) ? json.results : [];
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

// ─── Connections ──────────────────────────────────────────────────────────────

/**
 * Check the connection status between the current user and another user.
 * @param {string} targetUserId
 * @returns {Promise<{ status: 'none'|'pending'|'accepted'|'self', connection_id: string|null, i_am_requester: boolean }>}
 */
export async function getConnectionStatus(targetUserId) {
  return authRequest(`/api/connections/status/${encodeURIComponent(targetUserId)}`, { method: "GET" });
}

/** Send a connection request to another user */
export async function sendConnectionRequest(receiverId) {
  return authRequest("/api/connections/request", { method: "POST", body: { receiver_id: receiverId } });
}

/** @returns {Promise<object[]>} accepted connections with user details */
export async function getMyConnections() {
  const json = await authRequest("/api/connections");
  return Array.isArray(json?.connections) ? json.connections : [];
}

/** @returns {Promise<object[]>} pending requests received by me */
export async function getPendingRequests() {
  const json = await authRequest("/api/connections/pending");
  return Array.isArray(json?.requests) ? json.requests : [];
}

/** @returns {Promise<object[]>} pending requests sent by me */
export async function getSentRequests() {
  const json = await authRequest("/api/connections/sent");
  return Array.isArray(json?.sent_requests) ? json.sent_requests : [];
}

/** Accept a pending connection request */
export async function acceptConnection(connectionId) {
  return authRequest(`/api/connections/${encodeURIComponent(connectionId)}/accept`, { method: "POST" });
}

/** Reject a pending connection request */
export async function rejectConnection(connectionId) {
  return authRequest(`/api/connections/${encodeURIComponent(connectionId)}/reject`, { method: "POST" });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

/** @returns {Promise<object[]>} message history with another user */
export async function getMessages(otherUserId) {
  const json = await authRequest(`/api/messages/${encodeURIComponent(otherUserId)}`);
  return Array.isArray(json?.messages) ? json.messages : [];
}

/**
 * Send a message (with optional attachment) to a connected user.
 * @param {string} otherUserId
 * @param {string} content
 * @param {{ url: string, type: string, name: string, size: number }|null} attachment
 */
export async function sendMessage(otherUserId, content, attachment = null) {
  const body = { content };
  if (attachment) {
    body.attachment_url  = attachment.url;
    body.attachment_type = attachment.type;   // 'image' | 'file'
    body.attachment_name = attachment.name;
    body.attachment_size = attachment.size;
  }
  const json = await authRequest(`/api/messages/${encodeURIComponent(otherUserId)}`, {
    method: "POST",
    body,
  });
  return json?.message ?? null;
}

/** @returns {Promise<object[]>} last message + unread count per conversation */
export async function getMessagePreviews() {
  const json = await authRequest("/api/messages/previews");
  return Array.isArray(json?.previews) ? json.previews : [];
}

/** Mark all messages from otherUserId to me as read */
export async function markMessagesRead(otherUserId) {
  return authRequest(`/api/messages/${encodeURIComponent(otherUserId)}/read`, { method: "PATCH" });
}

// ─── Meetings / schedule ─────────────────────────────────────────────────────

/**
 * @param {{ from?: string, to?: string }} [range] ISO datetimes — filter meetings overlapping window
 * @returns {Promise<object[]>}
 */
export async function getMyMeetings(range = {}) {
  const params = new URLSearchParams();
  if (range.from) {
    params.set("from", range.from);
  }
  if (range.to) {
    params.set("to", range.to);
  }
  const q = params.toString();
  const path = q ? `/api/meetings?${q}` : "/api/meetings";
  const json = await authRequest(path, { method: "GET" });
  return Array.isArray(json?.meetings) ? json.meetings : [];
}

/**
 * @param {object} body — participant_id (uuid), starts_at, ends_at (ISO), title?, notes?
 */
export async function createMeeting(body) {
  return authRequest("/api/meetings", { method: "POST", body });
}

export async function cancelMeeting(meetingId) {
  return authRequest(`/api/meetings/${encodeURIComponent(meetingId)}`, { method: "DELETE" });
}

// ─── E2E Encryption Keys ──────────────────────────────────────────────────────

/**
 * Upload (or update) the current user's ECDH P-256 public key.
 * This is an idempotent upsert — safe to call on every login.
 * @param {string} publicKeyB64  base64-encoded SPKI public key
 */
export async function uploadMyPublicKey(publicKeyB64) {
  return authRequest("/api/keys/me", {
    method: "POST",
    body: { public_key: publicKeyB64 },
  });
}

/**
 * Fetch another user's ECDH P-256 public key from the server.
 * Returns null when the user has not yet generated / uploaded a key
 * (i.e. E2E is unavailable for that conversation — fall back to plaintext).
 * @param {string} userId
 * @returns {Promise<string|null>}  base64 SPKI string, or null
 */
export async function getUserPublicKey(userId) {
  try {
    const json = await authRequest(`/api/keys/${encodeURIComponent(userId)}`);
    return json?.public_key ?? null;
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
}
