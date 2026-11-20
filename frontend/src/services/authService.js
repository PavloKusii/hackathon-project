const STORAGE_KEY = "eg-auth";

export function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function authRequest(path, options = {}, token) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "");
    error.status = response.status;
    throw error;
  }
  return data;
}

export const ROLE_LABELS = {
  guest: "Гість",
  participant: "Учасник",
  organizer: "Організатор",
  superadmin: "Супер-адмін"
};
