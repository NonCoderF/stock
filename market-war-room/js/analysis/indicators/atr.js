import { average, round } from "../analysis-utils.js";

export function trueRange(candle, previousCandle) {
  if (!previousCandle) return candle.high - candle.low;
  return Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - previousCandle.close),
    Math.abs(candle.low - previousCandle.close)
  );
}

export function atrSeries(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length <= period) return [];
  const ranges = candles.map((candle, index) => trueRange(candle, candles[index - 1]));
  const seed = average(ranges.slice(1, period + 1));
  if (!Number.isFinite(seed)) return [];

  const series = Array(period).fill(null);
  let current = seed;
  series.push(current);

  for (let index = period + 1; index < ranges.length; index += 1) {
    current = (current * (period - 1) + ranges[index]) / period;
    series.push(current);
  }

  return series;
}

export function calculateATR(candles, period = 14) {
  const series = atrSeries(candles, period);
  const latest = series[series.length - 1];
  return Number.isFinite(latest) ? latest : null;
}

export function buildATRContext(candles) {
  const value = calculateATR(candles, 14);
  const close = candles[candles.length - 1]?.close;
  if (!Number.isFinite(value) || !Number.isFinite(close) || close <= 0) {
    return {
      value: null,
      percent: null,
      volatility: "Insufficient data"
    };
  }

  const history = atrSeries(candles, 14).filter(Number.isFinite);
  const recent = history.slice(-30);
  const baseline = average(recent);
  let volatility = "Moderate";
  if (Number.isFinite(baseline) && baseline > 0) {
    if (value >= baseline * 1.25) volatility = "High";
    else if (value <= baseline * 0.75) volatility = "Low";
  }

  return {
    value: round(value, 2),
    percent: round((value / close) * 100, 2),
    volatility
  };
}
