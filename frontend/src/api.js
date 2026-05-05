const DEPLOYED_BACKEND_URL = "https://cloudvandana-z84a.onrender.com";

// Remove trailing slash
function normalizeUrl(url) {
  return url.replace(/\/$/, "");
}

// API base (for normal API calls)
export const API_BASE = normalizeUrl(
  import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? "http://localhost:3000" : DEPLOYED_BACKEND_URL)
);

// Auth base (for login redirect)
export const AUTH_BASE = normalizeUrl(
  import.meta.env.VITE_AUTH_BASE_URL ||
    (import.meta.env.DEV ? "http://localhost:3000" : DEPLOYED_BACKEND_URL)
);

// 🔐 Salesforce Login Redirect
export function loginWithSalesforce() {
  window.location.href = `${AUTH_BASE}/login`;
}

// 🔴 Common error handler
async function readError(response, fallbackMessage) {
  const text = await response.text();

  if (response.status === 401) {
    return "Please login with Salesforce first.";
  }

  return text || fallbackMessage;
}

// 📥 Get validation rules
export async function fetchValidationRules() {
  const response = await fetch(`${API_BASE}/validation-rules`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Failed to fetch validation rules"));
  }

  return response.json();
}

// 🔍 Check login status
export async function fetchAuthStatus() {
  const response = await fetch(`${API_BASE}/auth/status`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Failed to check Salesforce login status"));
  }

  return response.json();
}

// 🚪 Logout
export async function logout() {
  const response = await fetch(`${API_BASE}/logout`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Failed to logout"));
  }

  return response.json();
}

// 🔄 Update single validation rule
export async function updateValidationRule(id, active) {
  const response = await fetch(`${API_BASE}/validation-rules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ active }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Failed to update validation rule"));
  }

  return response.json();
}