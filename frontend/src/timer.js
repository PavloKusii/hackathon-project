export function secondsFromParts(minutes, seconds) {
  const minuteValue = Number(minutes);
  const secondValue = Number(seconds);
  const total = (Number.isFinite(minuteValue) && minuteValue > 0 ? Math.floor(minuteValue) : 0) * 60
    + (Number.isFinite(secondValue) && secondValue > 0 ? Math.floor(secondValue) : 0);
  if (total <= 0) return 0;
  return Math.min(180 * 60, total);
}

export function partsFromSeconds(value) {
  const total = Number(value) || 0;
  if (total <= 0) return { minutes: "", seconds: "" };
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return {
    minutes: minutes ? String(minutes) : "",
    seconds: seconds ? String(seconds) : ""
  };
}

export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(Number(ms) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function limitCaption(scenario) {
  const seconds = Number(scenario?.timeLimitSeconds) || 0;
  const mode = scenario?.timeMode === "case" || scenario?.timeMode === "step"
    ? scenario.timeMode
    : (seconds > 0 ? "case" : "none");
  if (mode === "none" || seconds <= 0) return "";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const amount = minutes && rest ? `${minutes} хв ${rest} с` : minutes ? `${minutes} хв` : `${rest} с`;
  return mode === "step" ? `кожне завдання · ${amount}` : `весь тест · ${amount}`;
}
