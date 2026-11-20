import { authRequest } from "./authService";

export function loadManage(token) {
  return authRequest("/api/cases/manage", {}, token);
}

export function loadModeration(token) {
  return authRequest("/api/cases/moderation", {}, token);
}

export function createCase(token, payload) {
  return authRequest("/api/cases", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function updateCase(token, id, payload) {
  return authRequest(`/api/cases/${id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
}

async function draftRequest(path, method, payload, token) {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    const details = data.message || raw.trim().slice(0, 300) || response.statusText;
    throw new Error(`Не вдалося зберегти чернетку (HTTP ${response.status}): ${details}`);
  }
  if (!data.case?.id) throw new Error("Сервер відповів без збереженого кейсу.");
  return data;
}

export function saveCaseDraft(token, id, payload) {
  const body = { ...payload, draft: true, isDraft: true, status: "draft" };
  return id
    ? draftRequest(`/api/cases/${id}/draft`, "PUT", body, token)
    : draftRequest("/api/cases/drafts", "POST", body, token);
}

export function deleteCase(token, id) {
  return authRequest(`/api/cases/${id}`, { method: "DELETE" }, token);
}

export function deleteCaseDraft(token, id) {
  return authRequest(`/api/cases/${id}/draft`, { method: "DELETE" }, token);
}

export function moderateCase(token, id, status, note) {
  return authRequest(`/api/cases/${id}/moderate`, {
    method: "POST",
    body: JSON.stringify({ status, note })
  }, token);
}

export function saveAttempt(token, payload) {
  return authRequest("/api/attempts", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function loadAttempts(token) {
  return authRequest("/api/attempts", {}, token);
}

export function loadSessions(token) {
  return authRequest("/api/sessions", {}, token);
}

export function loadSessionByCode(code, token) {
  return authRequest(`/api/sessions/${encodeURIComponent(code)}`, {}, token);
}

export function loadRoomResults(code, token) {
  return authRequest(`/api/rooms/${encodeURIComponent(code)}/results`, {}, token);
}
