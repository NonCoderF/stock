import { average, latest, round } from "../analysis-utils.js";

export function buildVolumeSignal(candles, period = 20) {
  if (!Array.isArray(candles) || candles.length < period + 1) {
    return unavailableVolume();
  }

  const current = latest(candles);
  const previous = candles[candles.length - 2];
  const baseVolume = average(candles.slice(-(period + 1), -1).map((candle) => candle.volume));

  if (!current || !previous || !Number.isFinite(baseVolume) || baseVolume <= 0 || current.volume <= 0) {
    return unavailableVolume();
  }

  const volumeRatio = current.volume / baseVolume;
  const movePercent = previous.close ? ((current.close - previous.close) / previous.close) * 100 : 0;
  const range = current.high - current.low;
  const directionalClose = range > 0 ? (current.close - current.low) / range : 0.5;
  const elevated = volumeRatio >= 1.2;
  const bullishMove = movePercent > 0.15 && directionalClose >= 0.55;
  const bearishMove = movePercent < -0.15 && directionalClose <= 0.45;
  const score = elevated && bullishMove ? 1 : elevated && bearishMove ? -1 : 0;

  return {
    name: "Volume",
    value: `${round(volumeRatio, 2)}x average`,
    signal: score > 0 ? "BULLISH" : score < 0 ? "BEARISH" : "NEUTRAL",
    score,
    explanation: score > 0
      ? "Volume is elevated while price is moving up, so volume confirms the bullish move."
      : score < 0
        ? "Volume is elevated while price is moving down, so volume confirms the bearish move."
        : "Volume does not confirm a clear directional move.",
    details: {
      averageVolume: round(baseVolume, 0),
      currentVolume: round(current.volume, 0),
      volumeRatio: round(volumeRatio, 2)
    }
  };
}

function unavailableVolume() {
  return {
    name: "Volume",
    value: "Insufficient data",
    signal: "NEUTRAL",
    score: 0,
    explanation: "Volume confirmation needs current volume and a 20-candle average.",
    details: {}
  };
}
