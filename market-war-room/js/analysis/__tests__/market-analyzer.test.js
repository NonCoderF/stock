import test from "node:test";
import assert from "node:assert/strict";

import { calculateEMA } from "../indicators/ema.js";
import { calculateRSI } from "../indicators/rsi.js";
import { calculateMACD } from "../indicators/macd.js";
import { calculateVWAP } from "../indicators/vwap.js";
import { calculateATR } from "../indicators/atr.js";
import { calculateADX } from "../indicators/adx.js";
import { buildMarketStructure } from "../indicators/market-structure.js";
import { calculateDirectionScore, mapDirection } from "../scoring/direction-score.js";
import { analyzeMarket } from "../market-analyzer.js";
import { applyRelatedConfirmation, buildRelatedConfirmation } from "../related-confirmation.js";
import { bearishCandles, bullishCandles, sidewaysCandles } from "./sample-candles.js";

test("EMA calculates the latest exponential moving average", () => {
  const values = [1, 2, 3, 4, 5];
  assert.equal(calculateEMA(values, 3), 4);
});

test("RSI identifies strong upward momentum without treating it as bearish", () => {
  const values = Array.from({ length: 40 }, (_, index) => 100 + index);
  const rsi = calculateRSI(values, 14);
  assert.equal(rsi, 100);
});

test("MACD returns line, signal, and histogram", () => {
  const values = bullishCandles().map((candle) => candle.close);
  const macd = calculateMACD(values);
  assert.ok(Number.isFinite(macd.macdLine));
  assert.ok(Number.isFinite(macd.signalLine));
  assert.ok(Number.isFinite(macd.histogram));
});

test("VWAP uses typical price weighted by volume", () => {
  const candles = [
    { high: 12, low: 8, close: 10, volume: 100 },
    { high: 24, low: 18, close: 18, volume: 200 }
  ];
  assert.equal(calculateVWAP(candles), 50 / 3);
});

test("ATR returns current average true range", () => {
  const atr = calculateATR(bullishCandles(), 14);
  assert.ok(atr > 0);
});

test("ADX returns trend strength and directional index values", () => {
  const adx = calculateADX(bullishCandles(), 14);
  assert.ok(adx.value >= 0);
  assert.ok(Number.isFinite(adx.plusDI));
  assert.ok(Number.isFinite(adx.minusDI));
});

test("market structure detects higher high and higher low", () => {
  const structure = buildMarketStructure(bullishCandles());
  assert.equal(structure.type, "HIGHER_HIGH_HIGHER_LOW");
  assert.equal(structure.score, 2);
});

test("market structure detects lower high and lower low", () => {
  const structure = buildMarketStructure(bearishCandles());
  assert.equal(structure.type, "LOWER_HIGH_LOWER_LOW");
  assert.equal(structure.score, -2);
});

test("score calculation maps strong bullish and bearish totals", () => {
  const bullishScore = calculateDirectionScore([
    { score: 1 },
    { score: 1 },
    { score: 1 },
    { score: 1 },
    { score: 1 }
  ], { score: 2 });
  const bearishScore = calculateDirectionScore([
    { score: -1 },
    { score: -1 },
    { score: -1 },
    { score: -1 },
    { score: -1 }
  ], { score: -2 });

  assert.equal(bullishScore, 7);
  assert.equal(mapDirection(bullishScore), "STRONG_BULLISH");
  assert.equal(bearishScore, -7);
  assert.equal(mapDirection(bearishScore), "STRONG_BEARISH");
});

test("sideways markets remain neutral or low confidence", () => {
  const result = analyzeMarket(sidewaysCandles(114));
  assert.ok(["NEUTRAL", "BULLISH", "BEARISH"].includes(result.direction));
  assert.notEqual(result.confidence, "HIGH");
});

test("insufficient data does not fabricate an analysis", () => {
  const result = analyzeMarket(bullishCandles(20));
  assert.equal(result.status, "INSUFFICIENT_DATA");
  assert.equal(result.direction, "NEUTRAL");
  assert.equal(result.confidence, "LOW");
});

test("analyzer sorts candles and removes duplicate timestamps", () => {
  const candles = bullishCandles(80);
  const duplicate = { ...candles[10], close: candles[10].close + 3 };
  const result = analyzeMarket([duplicate, ...candles].reverse());
  assert.equal(result.status, "READY");
  assert.ok(Number.isFinite(result.directionScore));
});

test("related confirmation detects when related stocks conflict with the main direction", () => {
  const primary = { direction: "BULLISH" };
  const confirmation = buildRelatedConfirmation(primary, [
    { symbol: "AAA", analysis: { status: "READY", direction: "BEARISH", directionScore: -3, confidence: "MEDIUM" } },
    { symbol: "BBB", analysis: { status: "READY", direction: "STRONG_BEARISH", directionScore: -6, confidence: "HIGH" } },
    { symbol: "CCC", analysis: { status: "READY", direction: "NEUTRAL", directionScore: 0, confidence: "LOW" } }
  ]);

  assert.equal(confirmation.verdict, "CONFLICTING");
  assert.equal(confirmation.oppositeCount, 2);
});

test("conflicting related stocks reduce main confidence", () => {
  const primary = {
    direction: "BULLISH",
    confidence: "HIGH",
    summary: "Main symbol is bullish.",
    warnings: []
  };
  const confirmation = buildRelatedConfirmation(primary, [
    { symbol: "AAA", analysis: { status: "READY", direction: "BEARISH", directionScore: -3, confidence: "MEDIUM" } },
    { symbol: "BBB", analysis: { status: "READY", direction: "STRONG_BEARISH", directionScore: -6, confidence: "HIGH" } },
    { symbol: "CCC", analysis: { status: "READY", direction: "NEUTRAL", directionScore: 0, confidence: "LOW" } }
  ]);

  applyRelatedConfirmation(primary, confirmation);

  assert.equal(primary.confidence, "LOW");
  assert.match(primary.summary, /confidence is reduced/);
});
