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
