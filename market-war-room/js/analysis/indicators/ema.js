import { average } from "../analysis-utils.js";

export function emaSeries(values, period) {
  const clean = values.map(Number);
  if (clean.length < period || period <= 0 || clean.some((value) => !Number.isFinite(value))) {
    return [];
  }

  const seed = average(clean.slice(0, period));
  if (!Number.isFinite(seed)) return [];

  const multiplier = 2 / (period + 1);
  const series = Array(period - 1).fill(null);
  let current = seed;
  series.push(current);

  for (let index = period; index < clean.length; index += 1) {
    current = (clean[index] - current) * multiplier + current;
    series.push(current);
  }

  return series;
}

export function calculateEMA(values, period) {
  const series = emaSeries(values, period);
  const latest = series[series.length - 1];
  return Number.isFinite(latest) ? latest : null;
}
