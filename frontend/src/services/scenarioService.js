export async function fetchScenarios() {
  const response = await fetch("/api/scenarios");
  if (!response.ok) {
    throw new Error("scenarios");
  }
  const payload = await response.json();
  return Array.isArray(payload.scenarios) ? payload.scenarios : [];
}
