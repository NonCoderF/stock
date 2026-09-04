import { round } from "../analysis-utils.js";
import { emaSeries } from "./ema.js";

export function calculateMACD(values) {
  const ema12 = emaSeries(values, 12);
  const ema26 = emaSeries(values, 26);
  if (!ema12.length || !ema26.length) return null;

  const macdLine = values.map((_, index) => {
    const fast = ema12[index];
    const slow = ema26[index];
    return Number.isFinite(fast) && Number.isFinite(slow) ? fast - slow : null;
  });
  const compactMacd = macdLine.filter(Number.isFinite);
  const signalCompact = emaSeries(compactMacd, 9);
  if (!signalCompact.length) return null;

  let signalIndex = 0;
  const signalLine = macdLine.map((value) => {
    if (!Number.isFinite(value)) return null;
    const signal = signalCompact[signalIndex];
    signalIndex += 1;
    return Number.isFinite(signal) ? signal : null;
  });
  const histogram = macdLine.map((value, index) => {
    const signal = signalLine[index];
    return Number.isFinite(value) && Number.isFinite(signal) ? value - signal : null;
  });

  const latestIndex = histogram.map(Number.isFinite).lastIndexOf(true);
  if (latestIndex < 0) return null;

  return {
    macdLine: macdLine[latestIndex],
    signalLine: signalLine[latestIndex],
    histogram: histogram[latestIndex],
    histogramSeries: histogram
  };
}

export function buildMACDSignal(values) {
  const macd = calculateMACD(values);
  if (!macd) {
    return {
      name: "MACD",
      value: "Insufficient data",
      signal: "NEUTRAL",
      score: 0,
      explanation: "MACD needs enough candles for EMA12, EMA26, and the signal line.",
      details: {}
    };
  }

  const score = macd.histogram > 0 ? 1 : macd.histogram < 0 ? -1 : 0;
  const momentum = describeHistogramMomentum(macd.histogramSeries);

  return {
    name: "MACD",
    value: round(macd.histogram, 2),
    signal: score > 0 ? "BULLISH" : score < 0 ? "BEARISH" : "NEUTRAL",
    score,
    explanation: `MACD histogram is ${momentum.toLowerCase()}, which describes the current momentum shift.`,
    details: {
      macdLine: round(macd.macdLine, 2),
      signalLine: round(macd.signalLine, 2),
      histogram: round(macd.histogram, 2),
      momentum
    }
  };
}

export function describeHistogramMomentum(histogramSeries) {
  const values = histogramSeries.filter(Number.isFinite).slice(-4);
  if (!values.length) return "Neutral";

  const latest = values[values.length - 1];
  const previous = values.slice(0, -1);
  const averagePrevious = previous.length
    ? previous.reduce((sum, value) => sum + value, 0) / previous.length
    : latest;

  if (latest > 0 && latest >= averagePrevious) return "Positive and strengthening";
  if (latest > 0) return "Positive but weakening";
  if (latest < 0 && latest > averagePrevious) return "Negative but recovering";
  if (latest < 0) return "Negative and strengthening";
  return "Neutral";
}
