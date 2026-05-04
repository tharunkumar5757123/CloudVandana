export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
export const AUTH_BASE = import.meta.env.VITE_AUTH_BASE_URL || 'http://localhost:3000';

async function readError(response, fallbackMessage) {
  const text = await response.text();

  if (response.status === 401) {
    return 'Please login with Salesforce first.';
  }

  return text || fallbackMessage;
}

export async function fetchValidationRules() {
  const response = await fetch(`${API_BASE}/validation-rules`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to fetch validation rules'));
  }

  return response.json();
}

export async function fetchAuthStatus() {
  const response = await fetch(`${API_BASE}/auth/status`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to check Salesforce login status'));
  }

  return response.json();
}

export async function logout() {
  const response = await fetch(`${API_BASE}/logout`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to logout'));
  }

  return response.json();
}

export async function updateValidationRule(id, active) {
  const response = await fetch(`${API_BASE}/validation-rules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ active }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to update validation rule'));
  }

  return response.text();
}
