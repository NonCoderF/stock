export function bullishCandles(count = 120) {
  return buildCandles({
    count,
    start: 100,
    drift: 0.32,
    wave: 2.2,
    volumeBase: 1000,
    lastVolumeMultiplier: 1.45
  });
}

export function bearishCandles(count = 120) {
  return buildCandles({
    count,
    start: 180,
    drift: -0.34,
    wave: 2.1,
    volumeBase: 1100,
    lastVolumeMultiplier: 1.5
  });
}

export function sidewaysCandles(count = 120) {
  return buildCandles({
    count,
    start: 100,
    drift: 0,
    wave: 1.1,
    volumeBase: 900,
    lastVolumeMultiplier: 0.95
  });
}

function buildCandles({ count, start, drift, wave, volumeBase, lastVolumeMultiplier }) {
  const candles = [];
  let previousClose = start;
  const baseTime = Date.UTC(2026, 0, 1, 9, 15, 0);

  for (let index = 0; index < count; index += 1) {
    const cycle = Math.sin(index / 3) * wave;
    const close = start + drift * index + cycle;
    const open = previousClose;
    const high = Math.max(open, close) + 0.7 + Math.abs(Math.sin(index)) * 0.25;
    const low = Math.min(open, close) - 0.7 - Math.abs(Math.cos(index)) * 0.25;
    const isLast = index === count - 1;
    const directionBoost = Math.abs(close - open) > 0.2 ? 80 : 0;
    const volume = Math.round((volumeBase + directionBoost + (index % 7) * 15) * (isLast ? lastVolumeMultiplier : 1));
    candles.push({
      timestamp: baseTime + index * 60_000,
      open,
      high,
      low,
      close,
      volume
    });
    previousClose = close;
  }

  return candles;
}
