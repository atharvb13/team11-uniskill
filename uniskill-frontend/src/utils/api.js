const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function sendRequest(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || "Request failed.");
  }

  return json;
}

export async function registerUser(payload) {
  return sendRequest("/api/auth/register", payload);
}

export async function loginUser({ identifier, password }) {
  return sendRequest("/api/auth/login", { identifier, password });
}
