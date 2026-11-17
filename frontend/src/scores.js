export const BASE_SCORE = 100;

export function freshScores() {
  return { integrity: BASE_SCORE, trust: BASE_SCORE, effectiveness: BASE_SCORE };
}

export function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}
