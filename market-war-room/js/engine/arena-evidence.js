import { atr, ema, rsi, sma, volumeRatio } from "./indicators.js";
import { candleAgeMinutes, consecutiveColor, latest, percentChange, previous, recentHigh, recentLow } from "./candle-utils.js";

export function buildArenaEvidence(arena, candles) {
  const closeValues = candles.map((candle) => candle.close);
  const last = latest(candles);
  const prev = previous(candles);
  const high20 = recentHigh(candles);
  const low20 = recentLow(candles);
  const signals = {
    latestPrice: last?.close ?? null,
    previousPrice: prev?.close ?? null,
    latestReturnPercent: percentChange(last?.close, prev?.close),
    return3CandlesPercent: returnFrom(candles, 3),
    return5CandlesPercent: returnFrom(candles, 5),
    return10CandlesPercent: returnFrom(candles, 10),
    sma5: sma(closeValues, 5),
    sma10: sma(closeValues, 10),
    sma20: sma(closeValues, 20),
    ema9: ema(closeValues, 9),
    ema21: ema(closeValues, 21),
    rsi14: rsi(closeValues, 14),
    atr14: atr(candles, 14),
    volumeRatio20: volumeRatio(candles, 20),
    consecutiveGreenCandles: consecutiveColor(candles, "GREEN"),
    consecutiveRedCandles: consecutiveColor(candles, "RED"),
    recentHigh20: high20,
    recentLow20: low20,
    distanceFromRecentHighPercent: percentChange(high20, last?.close),
    distanceFromRecentLowPercent: percentChange(last?.close, low20),
    latestCandleTime: last?.time ?? null,
    candleAgeMinutes: candleAgeMinutes(last?.time)
  };
  const evidence = scoreEvidence(signals);
  return {
    ...arena,
    signals: {
      ...signals,
      deterministicBullEvidence: evidence.bull,
      deterministicBearEvidence: evidence.bear,
      bullEvidence: evidence.bull,
      bearEvidence: evidence.bear,
      winner: evidence.winner,
      preliminaryWinner: evidence.winner,
      momentum: evidence.momentum,
      warnings: candles.length ? [] : ["No candles returned"]
    },
    candleCount: candles.length
  };
}

function scoreEvidence(signals) {
  let bull = 0;
  let bear = 0;
  const price = signals.latestPrice;
  if (price > signals.sma20) bull += 14; else bear += 14;
  if (signals.ema9 > signals.ema21) bull += 16; else bear += 16;
  if (signals.latestReturnPercent > 0) bull += 10; else bear += 10;
  if (signals.return5CandlesPercent > 0) bull += 10; else bear += 10;
  if (signals.rsi14 >= 52 && signals.rsi14 <= 72) bull += 14;
  if (signals.rsi14 < 45 || signals.rsi14 > 78) bear += 14;
  if (signals.volumeRatio20 >= 1.15 && signals.latestReturnPercent >= 0) bull += 10;
  if (signals.volumeRatio20 >= 1.15 && signals.latestReturnPercent < 0) bear += 10;
  bull += Math.min(12, signals.consecutiveGreenCandles * 4);
  bear += Math.min(12, signals.consecutiveRedCandles * 4);
  bull = clamp(bull + 20);
  bear = clamp(bear + 20);
  const winner = Math.abs(bull - bear) < 8 ? "BALANCED" : bull > bear ? "BULLS" : "BEARS";
  const momentum = signals.return3CandlesPercent > 0.25 ? "RISING" : signals.return3CandlesPercent < -0.25 ? "FALLING" : "MIXED";
  return { bull, bear, winner, momentum };
}

function returnFrom(candles, count) {
  if (candles.length <= count) return null;
  return percentChange(candles[candles.length - 1].close, candles[candles.length - 1 - count].close);
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
