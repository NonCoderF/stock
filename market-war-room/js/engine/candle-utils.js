export function normalizeCandles(rawCandles) {
  const list = Array.isArray(rawCandles) ? rawCandles : [];
  return list
    .map((candle) => ({
      time: candle.time || candle.timestamp || candle.date || candle.datetime || candle.t,
      open: numberFrom(candle.open ?? candle.o ?? candle.Open),
      high: numberFrom(candle.high ?? candle.h ?? candle.High),
      low: numberFrom(candle.low ?? candle.l ?? candle.Low),
      close: numberFrom(candle.close ?? candle.c ?? candle.Close),
      volume: numberFrom(candle.volume ?? candle.v ?? candle.Volume)
    }))
    .filter((candle) => Number.isFinite(candle.close));
}

export function latest(candles) {
  return candles[candles.length - 1] || null;
}

export function previous(candles) {
  return candles[candles.length - 2] || null;
}

export function recentHigh(candles, count = 20) {
  const values = candles.slice(-count).map((candle) => candle.high).filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

export function recentLow(candles, count = 20) {
  const values = candles.slice(-count).map((candle) => candle.low).filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
}

export function percentChange(current, base) {
  if (!Number.isFinite(current) || !Number.isFinite(base) || base === 0) return null;
  return ((current - base) / base) * 100;
}

export function candleAgeMinutes(time) {
  if (!time) return null;
  const parsed = new Date(time);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - parsed.getTime()) / 60000));
}

export function consecutiveColor(candles, color) {
  let count = 0;
  for (let index = candles.length - 1; index >= 0; index -= 1) {
    const candle = candles[index];
    const isGreen = candle.close >= candle.open;
    if ((color === "GREEN" && isGreen) || (color === "RED" && !isGreen)) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

export function numberFrom(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
