import { round } from "../analysis-utils.js";
import { trueRange } from "./atr.js";

export function calculateADX(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period * 2 + 1) return null;

  const plusDm = [];
  const minusDm = [];
  const ranges = [];

  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
    ranges.push(trueRange(current, previous));
  }

  let smoothedTR = sum(ranges.slice(0, period));
  let smoothedPlusDM = sum(plusDm.slice(0, period));
  let smoothedMinusDM = sum(minusDm.slice(0, period));
  const dxValues = [];
  let latestPlusDI = null;
  let latestMinusDI = null;

  for (let index = period; index < ranges.length; index += 1) {
    if (index > period) {
      smoothedTR = smoothedTR - smoothedTR / period + ranges[index];
      smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDm[index];
      smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDm[index];
    }

    if (smoothedTR <= 0) continue;
    const plusDI = 100 * (smoothedPlusDM / smoothedTR);
    const minusDI = 100 * (smoothedMinusDM / smoothedTR);
    const denominator = plusDI + minusDI;
    if (denominator <= 0) continue;
    latestPlusDI = plusDI;
    latestMinusDI = minusDI;
    dxValues.push(100 * Math.abs(plusDI - minusDI) / denominator);
  }

  if (dxValues.length < period) return null;

  let adx = sum(dxValues.slice(0, period)) / period;
  for (let index = period; index < dxValues.length; index += 1) {
    adx = (adx * (period - 1) + dxValues[index]) / period;
  }

  return {
    value: adx,
    plusDI: latestPlusDI,
    minusDI: latestMinusDI
  };
}

export function buildADXContext(candles) {
  const adx = calculateADX(candles, 14);
  if (!adx) {
    return {
      value: null,
      plusDI: null,
      minusDI: null,
      strength: "Insufficient data",
      direction: "UNKNOWN"
    };
  }

  return {
    value: round(adx.value, 1),
    plusDI: round(adx.plusDI, 1),
    minusDI: round(adx.minusDI, 1),
    strength: classifyADX(adx.value),
    direction: adx.plusDI > adx.minusDI ? "BULLISH" : adx.minusDI > adx.plusDI ? "BEARISH" : "NEUTRAL"
  };
}

export function classifyADX(value) {
  if (!Number.isFinite(value)) return "Insufficient data";
  if (value < 20) return "Weak / sideways";
  if (value < 25) return "Trend developing";
  if (value <= 40) return "Strong trend";
  return "Very strong trend";
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
