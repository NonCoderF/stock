import { latest, normalizeAnalysisCandles, round, signalFromScore } from "./analysis-utils.js";
import { buildADXContext } from "./indicators/adx.js";
import { buildATRContext } from "./indicators/atr.js";
import { buildEMASignal } from "./indicators/ema-signal.js";
import { buildMACDSignal } from "./indicators/macd.js";
import { buildMarketStructure } from "./indicators/market-structure.js";
import { buildRSISignal } from "./indicators/rsi.js";
import { buildVolumeSignal } from "./indicators/volume.js";
import { buildVWAPSignal } from "./indicators/vwap.js";
import { calculateConfidence } from "./scoring/confidence.js";
import { calculateDirectionScore, mapDirection, MAX_DIRECTION_SCORE } from "./scoring/direction-score.js";
import {
  generateSummary,
  generateWarnings
} from "./explanation/market-narrative.js";

export const MINIMUM_ANALYSIS_CANDLES = 60;
export const PREFERRED_ANALYSIS_CANDLES = 100;

export function analyzeMarket(candles, options = {}) {
  const normalizedOptions = typeof options === "object" && options !== null ? options : {};
  const normalizedCandles = normalizeAnalysisCandles(candles, {
    includeCurrentCandle: normalizedOptions.includeCurrentCandle !== false
  });
  const analysisCandles = normalizedCandles.slice(-Math.max(PREFERRED_ANALYSIS_CANDLES, MINIMUM_ANALYSIS_CANDLES));

  if (analysisCandles.length < MINIMUM_ANALYSIS_CANDLES) {
    return buildInsufficientResult(analysisCandles.length, normalizedOptions);
  }

  const closes = analysisCandles.map((candle) => candle.close);
  const structure = buildMarketStructure(analysisCandles);
  const indicators = [
    buildVWAPSignal(getSessionCandles(analysisCandles)),
    buildEMASignal(analysisCandles),
    buildRSISignal(closes),
    buildMACDSignal(closes),
    buildVolumeSignal(analysisCandles)
  ];
  const structureIndicator = {
    name: "Market Structure",
    value: structureLabel(structure.type),
    signal: structure.signal,
    score: structure.score,
    explanation: structure.explanation,
    details: {
      type: structure.type,
      lastHighs: structure.lastHighs,
      lastLows: structure.lastLows
    }
  };
  const adx = buildADXContext(analysisCandles);
  const atr = buildATRContext(analysisCandles);
  const directionScore = calculateDirectionScore(indicators, structure);
  const direction = mapDirection(directionScore);
  const confidence = calculateConfidence({
    direction,
    directionScore,
    indicators,
    structure,
    adx
  });
  const result = {
    status: "READY",
    directionScore,
    maxDirectionScore: MAX_DIRECTION_SCORE,
    direction,
    confidence,
    indicators,
    structure,
    structureIndicator,
    adx,
    atr,
    candleCount: analysisCandles.length,
    preferredCandleCount: PREFERRED_ANALYSIS_CANDLES,
    includesCurrentCandle: normalizedOptions.includeCurrentCandle !== false,
    currentClose: round(latest(analysisCandles)?.close, 2),
    warnings: [],
    summary: "",
    debugRows: [
      ["VWAP", indicators[0].score],
      ["EMA", indicators[1].score],
      ["RSI", indicators[2].score],
      ["MACD", indicators[3].score],
      ["Structure", structure.score],
      ["Volume", indicators[4].score]
    ]
  };

  result.summary = generateSummary(result);
  result.warnings = generateWarnings(result);

  return result;
}

function buildInsufficientResult(candleCount, options) {
  const result = {
    status: "INSUFFICIENT_DATA",
    directionScore: 0,
    maxDirectionScore: MAX_DIRECTION_SCORE,
    direction: "NEUTRAL",
    confidence: "LOW",
    indicators: [],
    structure: {
      type: "UNKNOWN",
      score: 0
    },
    structureIndicator: null,
    adx: {
      value: null,
      plusDI: null,
      minusDI: null,
      strength: "Insufficient data"
    },
    atr: {
      value: null,
      percent: null,
      volatility: "Insufficient data"
    },
    candleCount,
    preferredCandleCount: PREFERRED_ANALYSIS_CANDLES,
    includesCurrentCandle: options.includeCurrentCandle !== false,
    currentClose: null,
    warnings: ["Insufficient data."],
    summary: "",
    debugRows: []
  };
  result.summary = generateSummary(result);
  return result;
}

function getSessionCandles(candles) {
  const latestCandle = latest(candles);
  if (!latestCandle) return candles;
  const latestDay = new Date(latestCandle.timestamp).toDateString();
  const session = candles.filter((candle) => new Date(candle.timestamp).toDateString() === latestDay);
  return session.length >= 5 ? session : candles;
}

function structureLabel(type) {
  if (type === "HIGHER_HIGH_HIGHER_LOW") return "Higher high + higher low";
  if (type === "LOWER_HIGH_LOWER_LOW") return "Lower high + lower low";
  if (type === "MIXED") return "Mixed / uncertain structure";
  return "Unknown";
}

export function indicatorSideFromScore(score) {
  return signalFromScore(score);
}
