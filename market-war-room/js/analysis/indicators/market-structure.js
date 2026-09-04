import { round } from "../analysis-utils.js";

export function detectPivots(candles, left = 2, right = 2) {
  const highs = [];
  const lows = [];

  for (let index = left; index < candles.length - right; index += 1) {
    const candle = candles[index];
    const before = candles.slice(index - left, index);
    const after = candles.slice(index + 1, index + right + 1);
    const around = [...before, ...after];
    if (around.every((item) => candle.high > item.high)) {
      highs.push({ index, price: candle.high, timestamp: candle.timestamp });
    }
    if (around.every((item) => candle.low < item.low)) {
      lows.push({ index, price: candle.low, timestamp: candle.timestamp });
    }
  }

  return { highs, lows };
}

export function buildMarketStructure(candles) {
  if (!Array.isArray(candles) || candles.length < 12) {
    return unknownStructure();
  }

  const pivots = detectPivots(candles, 2, 2);
  const lastHighs = pivots.highs.slice(-2);
  const lastLows = pivots.lows.slice(-2);

  if (lastHighs.length < 2 || lastLows.length < 2) {
    return unknownStructure();
  }

  const higherHigh = lastHighs[1].price > lastHighs[0].price;
  const higherLow = lastLows[1].price > lastLows[0].price;
  const lowerHigh = lastHighs[1].price < lastHighs[0].price;
  const lowerLow = lastLows[1].price < lastLows[0].price;

  let type = "MIXED";
  let score = 0;
  let explanation = "Recent swings are mixed, so market structure is uncertain.";

  if (higherHigh && higherLow) {
    type = "HIGHER_HIGH_HIGHER_LOW";
    score = 2;
    explanation = "Recent swings show a higher high and a higher low, which is bullish structure.";
  } else if (lowerHigh && lowerLow) {
    type = "LOWER_HIGH_LOWER_LOW";
    score = -2;
    explanation = "Recent swings show a lower high and a lower low, which is bearish structure.";
  }

  return {
    type,
    score,
    signal: score > 0 ? "BULLISH" : score < 0 ? "BEARISH" : "NEUTRAL",
    explanation,
    lastHighs: lastHighs.map(formatPivot),
    lastLows: lastLows.map(formatPivot)
  };
}

function unknownStructure() {
  return {
    type: "UNKNOWN",
    score: 0,
    signal: "NEUTRAL",
    explanation: "There are not enough clear swing highs and swing lows yet.",
    lastHighs: [],
    lastLows: []
  };
}

function formatPivot(pivot) {
  return {
    index: pivot.index,
    price: round(pivot.price, 2),
    timestamp: pivot.timestamp
  };
}
