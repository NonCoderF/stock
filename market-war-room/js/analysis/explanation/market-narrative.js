import { directionLabel, directionSide } from "../scoring/direction-score.js";

export function generateSummary(result) {
  if (result.status === "INSUFFICIENT_DATA") {
    return "Insufficient data. The analyzer needs more valid candles before it can build a responsible technical view.";
  }

  const side = directionSide(result.direction);
  const label = directionLabel(result.direction).toLowerCase();
  const supporting = result.indicators.filter((indicator) => indicator.signal === side && side !== "NEUTRAL");
  const opposing = result.indicators.filter((indicator) => indicator.score !== 0 && indicator.signal !== side);
  const macd = result.indicators.find((indicator) => indicator.name === "MACD");

  if (side === "NEUTRAL") {
    return [
      "The indicators are conflicting, so there is no strong directional edge right now.",
      structureSentence(result),
      result.adx?.strength ? `ADX says trend strength is ${result.adx.strength.toLowerCase()}.` : "",
      opposing.length ? "Some signals lean one way, but not enough of them agree." : ""
    ].filter(Boolean).join(" ");
  }

  return [
    `The market currently shows a ${label} technical direction.`,
    supporting.length ? `${supporting.slice(0, 3).map((item) => item.name).join(", ")} support that view.` : "",
    structureSentence(result),
    opposing.length ? `However, ${opposing.slice(0, 2).map((item) => item.name).join(" and ")} disagree, so this is not a clean all-signals-agree setup.` : "",
    macd?.details?.momentum?.includes("weakening") || macd?.details?.momentum?.includes("recovering")
      ? `MACD is ${macd.details.momentum.toLowerCase()}, so momentum may be changing.`
      : ""
  ].filter(Boolean).join(" ");
}

export function generateWarnings(result) {
  const warnings = [];
  if (result.status === "INSUFFICIENT_DATA") warnings.push("Insufficient data.");
  if (result.candleCount < 100) warnings.push("Fewer than 100 candles are available, so the read may be less stable.");
  if (result.structure?.type === "MIXED") warnings.push("Market structure is mixed.");
  if (result.adx?.strength === "Weak / sideways") warnings.push("Trend strength is low.");
  if (result.indicators.filter((indicator) => indicator.score !== 0).length >= 3 && result.direction === "NEUTRAL") {
    warnings.push("Directional indicators conflict with each other.");
  }
  return warnings;
}

function structureSentence(result) {
  if (result.structure?.type === "HIGHER_HIGH_HIGHER_LOW") return "Market structure is constructive with a higher high and higher low.";
  if (result.structure?.type === "LOWER_HIGH_LOWER_LOW") return "Market structure is bearish with a lower high and lower low.";
  if (result.structure?.type === "MIXED") return "Market structure is mixed.";
  return "Market structure is not clear yet.";
}
