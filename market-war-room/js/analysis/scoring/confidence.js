import { directionSide } from "./direction-score.js";

export function calculateConfidence({ direction, directionScore, indicators, structure, adx }) {
  const side = directionSide(direction);
  const directionalIndicators = indicators.filter((indicator) => indicator.score !== 0);
  const agreeing = side === "NEUTRAL"
    ? indicators.filter((indicator) => indicator.score === 0).length
    : directionalIndicators.filter((indicator) => indicator.signal === side).length;
  const contradicting = side === "NEUTRAL"
    ? directionalIndicators.length
    : directionalIndicators.filter((indicator) => indicator.signal !== side).length;
  const structureClear = structure?.type === "HIGHER_HIGH_HIGHER_LOW" || structure?.type === "LOWER_HIGH_LOWER_LOW";
  const structureAgrees = structureClear && structure.signal === side;
  const trendStrong = Number(adx?.value) >= 25;
  const trendWeak = Number(adx?.value) < 20;
  const scoreMagnitude = Math.abs(directionScore);

  if (scoreMagnitude >= 5 && agreeing >= 4 && structureAgrees && trendStrong && contradicting <= 1) {
    return "HIGH";
  }

  if (scoreMagnitude <= 1 || structure?.type === "MIXED" || structure?.type === "UNKNOWN" || trendWeak || contradicting >= 3) {
    return "LOW";
  }

  return "MEDIUM";
}
