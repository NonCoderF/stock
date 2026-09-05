import { directionLabel } from "./scoring/direction-score.js";

export const STOCK_SEARCH_WEIGHTS = {
  intradayMargin: 45,
  mediumVolatility: 25,
  volumeConfirmation: 15,
  signalConfidence: 10,
  validData: 5
};

export const STOCK_SEARCH_CONFIG = {
  idealAtrPercentMin: 0.7,
  idealAtrPercentMax: 2.2,
  acceptableAtrPercentMin: 0.35,
  acceptableAtrPercentMax: 3.5,
  highIntradayMarginPercent: 1.5
};

export function rankStockCandidates(candidates, config = STOCK_SEARCH_CONFIG) {
  return (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => scoreStockCandidate(candidate, config))
    .sort((a, b) => b.searchScore - a.searchScore)
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1
    }));
}

export function scoreStockCandidate(candidate, config = STOCK_SEARCH_CONFIG) {
  const analysis = candidate?.analysis;
  if (!analysis || analysis.status !== "READY") {
    return {
      symbol: candidate?.symbol || "UNKNOWN",
      role: candidate?.role || "RELATED",
      status: "UNAVAILABLE",
      searchScore: 0,
      volatilityScore: 0,
      rangeScore: 0,
      volumeScore: 0,
      confidenceScore: 0,
      atrPercent: null,
      intradayRangePercent: null,
      direction: null,
      directionLabel: "Unavailable",
      reason: candidate?.message || "Not enough candle data to rank this stock."
    };
  }

  const atrPercent = Number(analysis.atr?.percent);
  const intradayRangePercent = estimateIntradayRangePercent(candidate.candles, analysis.currentClose);
  const volumeIndicator = analysis.indicators.find((indicator) => indicator.name === "Volume");
  const volatilityScore = mediumVolatilityScore(atrPercent, config);
  const marginScore = intradayMarginScore(intradayRangePercent, config);
  const volumeScore = volumeIndicator?.score !== 0 ? STOCK_SEARCH_WEIGHTS.volumeConfirmation : 0;
  const confidenceScore = confidenceToScore(analysis.confidence);
  const validDataScore = analysis.candleCount >= analysis.preferredCandleCount ? STOCK_SEARCH_WEIGHTS.validData : 2;
  const searchScore = Math.round(marginScore + volatilityScore + volumeScore + confidenceScore + validDataScore);

  return {
    symbol: candidate.symbol,
    role: candidate.role || "RELATED",
    status: "READY",
    searchScore,
    marginScore: Math.round(marginScore),
    volatilityScore: Math.round(volatilityScore),
    volumeScore,
    confidenceScore,
    atrPercent,
    intradayMarginPercent: intradayRangePercent,
    intradayRangePercent,
    direction: analysis.direction,
    directionLabel: directionLabel(analysis.direction),
    confidence: analysis.confidence,
    reason: buildSearchReason({ atrPercent, intradayRangePercent, volumeIndicator, analysis })
  };
}

export function mediumVolatilityScore(atrPercent, config = STOCK_SEARCH_CONFIG) {
  if (!Number.isFinite(atrPercent) || atrPercent <= 0) return 0;
  if (atrPercent >= config.idealAtrPercentMin && atrPercent <= config.idealAtrPercentMax) {
    return STOCK_SEARCH_WEIGHTS.mediumVolatility;
  }
  if (atrPercent < config.acceptableAtrPercentMin || atrPercent > config.acceptableAtrPercentMax) {
    return 0;
  }

  if (atrPercent < config.idealAtrPercentMin) {
    const span = config.idealAtrPercentMin - config.acceptableAtrPercentMin;
    return STOCK_SEARCH_WEIGHTS.mediumVolatility * ((atrPercent - config.acceptableAtrPercentMin) / span);
  }

  const span = config.acceptableAtrPercentMax - config.idealAtrPercentMax;
  return STOCK_SEARCH_WEIGHTS.mediumVolatility * ((config.acceptableAtrPercentMax - atrPercent) / span);
}

export function intradayMarginScore(rangePercent, config = STOCK_SEARCH_CONFIG) {
  if (!Number.isFinite(rangePercent) || rangePercent <= 0) return 0;
  return Math.min(STOCK_SEARCH_WEIGHTS.intradayMargin, (rangePercent / config.highIntradayMarginPercent) * STOCK_SEARCH_WEIGHTS.intradayMargin);
}

function estimateIntradayRangePercent(candles, currentClose) {
  const close = Number(currentClose);
  if (!Number.isFinite(close) || close <= 0 || !Array.isArray(candles) || !candles.length) return null;
  const latest = candles[candles.length - 1];
  const latestDay = new Date(latest.timestamp || latest.time).toDateString();
  const sessionCandles = candles.filter((candle) => new Date(candle.timestamp || candle.time).toDateString() === latestDay);
  const window = sessionCandles.length >= 5 ? sessionCandles : candles.slice(-20);
  const highs = window.map((candle) => Number(candle.high)).filter(Number.isFinite);
  const lows = window.map((candle) => Number(candle.low)).filter(Number.isFinite);
  if (!highs.length || !lows.length) return null;
  return ((Math.max(...highs) - Math.min(...lows)) / close) * 100;
}

function confidenceToScore(confidence) {
  if (confidence === "HIGH") return STOCK_SEARCH_WEIGHTS.signalConfidence;
  if (confidence === "MEDIUM") return Math.round(STOCK_SEARCH_WEIGHTS.signalConfidence * 0.65);
  return Math.round(STOCK_SEARCH_WEIGHTS.signalConfidence * 0.25);
}

function buildSearchReason({ atrPercent, intradayRangePercent, volumeIndicator, analysis }) {
  const parts = [];
  if (Number.isFinite(atrPercent)) parts.push(`ATR is ${atrPercent.toFixed(2)}% of price`);
  if (Number.isFinite(intradayRangePercent)) parts.push(`intraday margin is ${intradayRangePercent.toFixed(2)}%`);
  if (volumeIndicator?.score !== 0) parts.push("volume confirms the move");
  parts.push(`direction is ${directionLabel(analysis.direction).toLowerCase()}`);
  return parts.join(", ");
}
