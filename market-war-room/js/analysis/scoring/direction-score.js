export const DIRECTION_THRESHOLDS = {
  STRONG_BULLISH: { min: 5, max: 7 },
  BULLISH: { min: 2, max: 4 },
  NEUTRAL: { min: -1, max: 1 },
  BEARISH: { min: -4, max: -2 },
  STRONG_BEARISH: { min: -7, max: -5 }
};

export const MAX_DIRECTION_SCORE = 7;

export function calculateDirectionScore(indicators, structure) {
  const indicatorScore = indicators.reduce((total, indicator) => {
    const score = Number(indicator.score);
    return total + (Number.isFinite(score) ? score : 0);
  }, 0);
  const structureScore = Number(structure?.score);
  return indicatorScore + (Number.isFinite(structureScore) ? structureScore : 0);
}

export function mapDirection(score) {
  if (score >= DIRECTION_THRESHOLDS.STRONG_BULLISH.min) return "STRONG_BULLISH";
  if (score >= DIRECTION_THRESHOLDS.BULLISH.min) return "BULLISH";
  if (score <= DIRECTION_THRESHOLDS.STRONG_BEARISH.max) return "STRONG_BEARISH";
  if (score <= DIRECTION_THRESHOLDS.BEARISH.max) return "BEARISH";
  return "NEUTRAL";
}

export function directionSide(direction) {
  if (direction === "STRONG_BULLISH" || direction === "BULLISH") return "BULLISH";
  if (direction === "STRONG_BEARISH" || direction === "BEARISH") return "BEARISH";
  return "NEUTRAL";
}

export function directionLabel(direction) {
  return String(direction || "NEUTRAL").replace(/_/g, " ");
}
