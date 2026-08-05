export function sma(values, period) {
  const clean = values.filter(Number.isFinite);
  if (clean.length < period) return null;
  const slice = clean.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

export function ema(values, period) {
  const clean = values.filter(Number.isFinite);
  if (clean.length < period) return null;
  const multiplier = 2 / (period + 1);
  let current = clean.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  clean.slice(period).forEach((value) => {
    current = (value - current) * multiplier + current;
  });
  return current;
}

export function rsi(values, period = 14) {
  const clean = values.filter(Number.isFinite);
  if (clean.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let index = clean.length - period; index < clean.length; index += 1) {
    const change = clean[index] - clean[index - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function atr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length <= period) return null;
  const trs = [];
  for (let index = 1; index < candles.length; index += 1) {
    const candle = candles[index];
    const previous = candles[index - 1];
    trs.push(Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previous.close),
      Math.abs(candle.low - previous.close)
    ));
  }
  return sma(trs, period);
}

export function volumeRatio(candles, period = 20) {
  if (!Array.isArray(candles) || candles.length < period + 1) return null;
  const latest = candles[candles.length - 1]?.volume;
  const base = sma(candles.slice(0, -1).map((candle) => candle.volume), period);
  if (!Number.isFinite(latest) || !Number.isFinite(base) || base === 0) return null;
  return latest / base;
}
