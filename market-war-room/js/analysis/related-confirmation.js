import { directionLabel, directionSide } from "./scoring/direction-score.js";

export function buildRelatedConfirmation(primaryAnalysis, relatedAnalyses) {
  const usable = (Array.isArray(relatedAnalyses) ? relatedAnalyses : [])
    .filter((item) => item?.analysis?.status === "READY");
  const failed = (Array.isArray(relatedAnalyses) ? relatedAnalyses : [])
    .filter((item) => item?.analysis?.status !== "READY");
  const primarySide = directionSide(primaryAnalysis?.direction);

  const aligned = usable.filter((item) => directionSide(item.analysis.direction) === primarySide && primarySide !== "NEUTRAL");
  const opposite = usable.filter((item) => {
    const side = directionSide(item.analysis.direction);
    return primarySide !== "NEUTRAL" && side !== "NEUTRAL" && side !== primarySide;
  });
  const neutral = usable.filter((item) => directionSide(item.analysis.direction) === "NEUTRAL");

  let verdict = "MIXED";
  if (primarySide === "NEUTRAL") verdict = "MAIN_NEUTRAL";
  else if (aligned.length >= 2 && opposite.length === 0) verdict = "CONFIRMED";
  else if (opposite.length >= 2) verdict = "CONFLICTING";
  else if (aligned.length >= 2) verdict = "PARTLY_CONFIRMED";

  return {
    verdict,
    primarySide,
    totalRequested: relatedAnalyses.length,
    successfulCount: usable.length,
    failedCount: failed.length,
    alignedCount: aligned.length,
    oppositeCount: opposite.length,
    neutralCount: neutral.length,
    symbols: relatedAnalyses.map((item) => ({
      symbol: item.symbol,
      status: item.analysis?.status || "FAILED",
      direction: item.analysis?.direction || null,
      directionLabel: item.analysis?.direction ? directionLabel(item.analysis.direction) : "Unavailable",
      score: item.analysis?.directionScore ?? null,
      confidence: item.analysis?.confidence || null,
      message: item.message || null
    })),
    summary: buildRelatedSummary({ verdict, primarySide, usable, aligned, opposite, neutral, failed })
  };
}

export function applyRelatedConfirmation(primaryAnalysis, confirmation) {
  if (!primaryAnalysis || !confirmation) return primaryAnalysis;

  primaryAnalysis.relatedConfirmation = confirmation;

  if (confirmation.verdict === "CONFLICTING") {
    primaryAnalysis.confidence = "LOW";
    primaryAnalysis.warnings = [
      ...(primaryAnalysis.warnings || []),
      "Related stocks conflict with the main symbol."
    ];
    primaryAnalysis.summary = `${primaryAnalysis.summary} Related stocks conflict with this read, so confidence is reduced.`;
    return primaryAnalysis;
  }

  if (confirmation.verdict === "MIXED" && primaryAnalysis.confidence === "HIGH") {
    primaryAnalysis.confidence = "MEDIUM";
    primaryAnalysis.warnings = [
      ...(primaryAnalysis.warnings || []),
      "Related stocks are mixed."
    ];
    primaryAnalysis.summary = `${primaryAnalysis.summary} Related stocks are mixed, so the read is less clean.`;
    return primaryAnalysis;
  }

  if (confirmation.verdict === "PARTLY_CONFIRMED" && primaryAnalysis.confidence === "HIGH") {
    primaryAnalysis.confidence = "MEDIUM";
    primaryAnalysis.summary = `${primaryAnalysis.summary} Related stocks partly confirm this read.`;
    return primaryAnalysis;
  }

  if (confirmation.verdict === "CONFIRMED") {
    primaryAnalysis.summary = `${primaryAnalysis.summary} Related stocks also support this direction.`;
  }

  return primaryAnalysis;
}


function buildRelatedSummary({ verdict, primarySide, usable, aligned, opposite, neutral, failed }) {
  if (!usable.length) {
    return "Related-stock confirmation is unavailable because none of the related symbols returned enough valid candle data.";
  }

  if (verdict === "MAIN_NEUTRAL") {
    return "The main symbol is mixed, so related stocks are shown as context rather than confirmation.";
  }

  if (verdict === "CONFIRMED") {
    return `Related stocks support the main ${primarySide.toLowerCase()} read. Most checked symbols point in the same direction.`;
  }

  if (verdict === "PARTLY_CONFIRMED") {
    return `Related stocks mostly support the main ${primarySide.toLowerCase()} read, but the confirmation is not clean.`;
  }

  if (verdict === "CONFLICTING") {
    return `Related stocks conflict with the main ${primarySide.toLowerCase()} read. Treat the single-symbol signal with more caution.`;
  }

  return [
    "Related stocks are mixed.",
    `${aligned.length} align, ${opposite.length} conflict, and ${neutral.length} are neutral.`,
    failed.length ? `${failed.length} related symbol could not be analyzed.` : ""
  ].filter(Boolean).join(" ");
}
