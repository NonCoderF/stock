import { latest, round } from "../analysis-utils.js";

export function calculateVWAP(candles) {
  let weightedPrice = 0;
  let totalVolume = 0;

  candles.forEach((candle) => {
    if (!Number.isFinite(candle.high) || !Number.isFinite(candle.low) || !Number.isFinite(candle.close)) return;
    if (!Number.isFinite(candle.volume) || candle.volume <= 0) return;
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    weightedPrice += typicalPrice * candle.volume;
    totalVolume += candle.volume;
  });

  if (totalVolume <= 0) return null;
  return weightedPrice / totalVolume;
}

export function buildVWAPSignal(candles, tolerancePercent = 0.08) {
  const current = latest(candles);
  const vwap = calculateVWAP(candles);
  if (!current || !Number.isFinite(vwap) || !Number.isFinite(current.close)) {
    return unavailableVWAP();
  }

  const tolerance = current.close * (tolerancePercent / 100);
  const difference = current.close - vwap;
  const score = Math.abs(difference) <= tolerance ? 0 : difference > 0 ? 1 : -1;

  return {
    name: "VWAP",
    value: round(vwap, 2),
    signal: score > 0 ? "BULLISH" : score < 0 ? "BEARISH" : "NEUTRAL",
    score,
    explanation: score > 0
      ? "Price is above VWAP, so buyers are holding above the session average price."
      : score < 0
        ? "Price is below VWAP, so sellers are keeping price under the session average price."
        : "Price is very close to VWAP, so this signal is neutral.",
    details: {
      price: round(current.close, 2),
      vwap: round(vwap, 2)
    }
  };
}

function unavailableVWAP() {
  return {
    name: "VWAP",
    value: "Insufficient data",
    signal: "NEUTRAL",
    score: 0,
    explanation: "VWAP needs valid price and volume data.",
    details: {}
  };
}
