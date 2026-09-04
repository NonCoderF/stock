import { latest, round } from "../analysis-utils.js";
import { calculateEMA } from "./ema.js";

export function buildEMASignal(candles) {
  const closes = candles.map((candle) => candle.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const current = latest(candles);

  if (!current || !Number.isFinite(ema20) || !Number.isFinite(ema50)) {
    return {
      name: "EMA",
      value: "Insufficient data",
      signal: "NEUTRAL",
      score: 0,
      explanation: "EMA comparison needs at least 50 valid closing prices.",
      details: {}
    };
  }

  const score = ema20 > ema50 ? 1 : ema20 < ema50 ? -1 : 0;
  const stackedBullish = current.close > ema20 && ema20 > ema50;
  const stackedBearish = current.close < ema20 && ema20 < ema50;
  const explanation = stackedBullish
    ? "Price is above EMA20 and EMA20 is above EMA50, a stronger bullish alignment."
    : stackedBearish
      ? "Price is below EMA20 and EMA20 is below EMA50, a stronger bearish alignment."
      : score > 0
        ? "EMA20 is above EMA50, so the shorter trend is stronger than the longer trend."
        : score < 0
          ? "EMA20 is below EMA50, so the shorter trend is weaker than the longer trend."
          : "EMA20 and EMA50 are very close, so this signal is neutral.";

  return {
    name: "EMA",
    value: `EMA20 ${round(ema20, 2)} / EMA50 ${round(ema50, 2)}`,
    signal: score > 0 ? "BULLISH" : score < 0 ? "BEARISH" : "NEUTRAL",
    score,
    explanation,
    details: {
      ema20: round(ema20, 2),
      ema50: round(ema50, 2),
      stackedBullish,
      stackedBearish
    }
  };
}
