export function normalizeAnalysisCandles(candles, options = {}) {
  const includeCurrentCandle = options.includeCurrentCandle !== false;
  const seen = new Map();

  (Array.isArray(candles) ? candles : []).forEach((candle, index) => {
    const timestamp = normalizeTimestamp(candle?.timestamp ?? candle?.time ?? candle?.date ?? candle?.datetime ?? candle?.t);
    const normalized = {
      timestamp: timestamp ?? index,
      open: finiteNumber(candle?.open),
      high: finiteNumber(candle?.high),
      low: finiteNumber(candle?.low),
      close: finiteNumber(candle?.close),
      volume: Math.max(0, finiteNumber(candle?.volume) ?? 0)
    };

    if (
      Number.isFinite(normalized.open) &&
      Number.isFinite(normalized.high) &&
      Number.isFinite(normalized.low) &&
      Number.isFinite(normalized.close) &&
      normalized.high >= normalized.low
    ) {
      seen.set(normalized.timestamp, normalized);
    }
  });

  const sorted = [...seen.values()].sort((a, b) => a.timestamp - b.timestamp);
  return includeCurrentCandle ? sorted : sorted.slice(0, -1);
}

export function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function round(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

export function latest(candles) {
  return candles[candles.length - 1] || null;
}

export function average(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

export function signalFromScore(score) {
  if (score > 0) return "BULLISH";
  if (score < 0) return "BEARISH";
  return "NEUTRAL";
}

function normalizeTimestamp(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric > 0 && numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}
