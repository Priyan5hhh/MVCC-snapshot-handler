const API_BASE = "http://localhost:5000/api";

/**
 * Central API request helper.
 * Always returns `payload.data` on success.
 * Always throws a human-readable Error on failure.
 */
export async function apiRequest(path, options = {}) {
  const hasBody = options.body !== undefined;
  const headers = {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Cannot reach server — is it running on port 5000?");
  }

  const raw = await response.text();

  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Invalid JSON response (HTTP ${response.status})`);
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Request failed (HTTP ${response.status})`);
  }

  return payload.data;
}
