import { round } from "../analysis-utils.js";

export function rsiSeries(values, period = 14) {
  const clean = values.map(Number);
  if (clean.length <= period || clean.some((value) => !Number.isFinite(value))) return [];

  const series = Array(period).fill(null);
  let gain = 0;
  let loss = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = clean[index] - clean[index - 1];
    if (change >= 0) gain += change;
    else loss += Math.abs(change);
  }

  let averageGain = gain / period;
  let averageLoss = loss / period;
  series.push(toRsi(averageGain, averageLoss));

  for (let index = period + 1; index < clean.length; index += 1) {
    const change = clean[index] - clean[index - 1];
    const currentGain = change > 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;
    averageGain = (averageGain * (period - 1) + currentGain) / period;
    averageLoss = (averageLoss * (period - 1) + currentLoss) / period;
    series.push(toRsi(averageGain, averageLoss));
  }

  return series;
}

export function calculateRSI(values, period = 14) {
  const series = rsiSeries(values, period);
  const latest = series[series.length - 1];
  return Number.isFinite(latest) ? latest : null;
}

export function buildRSISignal(values) {
  const value = calculateRSI(values, 14);
  if (!Number.isFinite(value)) {
    return {
      name: "RSI",
      value: "Insufficient data",
      signal: "NEUTRAL",
      score: 0,
      explanation: "RSI needs at least 15 valid closing prices.",
      details: {}
    };
  }

  const score = value >= 55 ? 1 : value <= 45 ? -1 : 0;
  let explanation = "RSI is neutral, so momentum is not clearly bullish or bearish.";
  if (value >= 70) explanation = "RSI shows strong bullish momentum and may be getting extended.";
  else if (value >= 55) explanation = "RSI is above 55, showing bullish momentum.";
  else if (value <= 30) explanation = "RSI shows strong bearish momentum and may be oversold.";
  else if (value <= 45) explanation = "RSI is below 45, showing bearish momentum.";

  return {
    name: "RSI",
    value: round(value, 1),
    signal: score > 0 ? "BULLISH" : score < 0 ? "BEARISH" : "NEUTRAL",
    score,
    explanation,
    details: { rsi: round(value, 1) }
  };
}

function toRsi(averageGain, averageLoss) {
  if (averageLoss === 0) return 100;
  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}
