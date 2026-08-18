export function determineMarketSignal({
  bullStrength,
  bearStrength,
  campaign,
  entryArena,
  confirmationArena,
  contextArena
}) {
  const bull = Number.isFinite(bullStrength) ? bullStrength : 0;
  const bear = Number.isFinite(bearStrength) ? bearStrength : 0;
  const difference = bull - bear;

  let signal = "WAIT";
  let headline = "NO CLEAR WINNER";
  let longAction = "WAIT";
  let tone = "balanced";

  if (difference >= 20) {
    signal = "STRONG_BUY";
    headline = "JOIN THE BULLS";
    longAction = "BUY";
    tone = "bull";
  } else if (difference >= 8) {
    signal = "BUY";
    headline = "BULLS HAVE THE EDGE";
    longAction = "BUY";
    tone = "bull";
  } else if (difference <= -20) {
    signal = "STRONG_SELL";
    headline = "BEARS CONTROL THE FIELD";
    longAction = "DO_NOT_BUY";
    tone = "bear";
  } else if (difference <= -8) {
    signal = "SELL";
    headline = "STAY AWAY FROM LONGS";
    longAction = "DO_NOT_BUY";
    tone = "bear";
  }

  const entryWinner = entryArena?.signals?.winner || entryArena?.winner || "UNKNOWN";
  const confirmationWinner =
    confirmationArena?.signals?.winner || confirmationArena?.winner || "UNKNOWN";
  const contextWinner = contextArena?.signals?.winner || contextArena?.winner || "UNKNOWN";

  const warnings = [];

  if (longAction === "BUY" && entryWinner === "BEARS") {
    warnings.push("Entry arena remains bearish.");
  }

  if (longAction === "BUY" && confirmationWinner === "BEARS") {
    warnings.push("Confirmation arena remains bearish.");
  }

  if (longAction === "BUY" && campaign?.dominance === "BEARS") {
    warnings.push("Weighted campaign remains bearish.");
  }

  if (warnings.length > 0) {
    signal = "WAIT";
    headline = "WAIT FOR BULLISH CONFIRMATION";
    longAction = "WAIT";
    tone = "balanced";
  }

  return {
    signal,
    headline,
    longAction,
    tone,
    bullStrength: bull,
    bearStrength: bear,
    difference,
    campaignDominance: campaign?.dominance || "BALANCED",
    entryWinner,
    confirmationWinner,
    contextWinner,
    warnings
  };
}

export function getCommanderPresentation(marketSignal) {
  switch (marketSignal.signal) {
    case "STRONG_BUY":
      return {
        action: "STRONG BUY",
        headline: "JOIN THE BULLS",
        tone: "bull",
        description:
          "Bulls control the weighted battlefield with strong multi-timeframe support."
      };

    case "BUY":
      return {
        action: "BUY",
        headline: "BULLS HAVE THE EDGE",
        tone: "bull",
        description:
          "Buyers have a measurable advantage, but risk controls still apply."
      };

    case "STRONG_SELL":
      return {
        action: "STRONG SELL",
        headline: "BEARS CONTROL THE FIELD",
        tone: "bear",
        description:
          "Selling pressure strongly exceeds buying pressure. Do not open a new long position."
      };

    case "SELL":
      return {
        action: "SELL",
        headline: "STAY AWAY FROM LONGS",
        tone: "bear",
        description: "Bears hold a measurable advantage. Avoid new long entries."
      };

    default:
      return {
        action: "WAIT",
        headline: "NO CLEAR WINNER",
        tone: "balanced",
        description:
          "Bull and bear forces are too close for a reliable directional entry."
      };
  }
}

export function calculateSignalConfidence(marketSignal) {
  const absoluteDifference = Math.abs(marketSignal.difference);
  const base = 50 + Math.min(absoluteDifference, 40);

  let adjustment = 0;

  if (marketSignal.signal === "STRONG_BUY" && marketSignal.entryWinner === "BULLS") {
    adjustment += 4;
  }

  if (
    marketSignal.signal === "STRONG_BUY" &&
    marketSignal.confirmationWinner === "BULLS"
  ) {
    adjustment += 4;
  }

  if (marketSignal.signal === "STRONG_SELL" && marketSignal.entryWinner === "BEARS") {
    adjustment += 4;
  }

  if (
    marketSignal.signal === "STRONG_SELL" &&
    marketSignal.confirmationWinner === "BEARS"
  ) {
    adjustment += 4;
  }

  return Math.max(50, Math.min(95, Math.round(base + adjustment)));
}

export function buildLocalSignalExplanation(marketSignal) {
  const gap = Math.abs(marketSignal.difference);

  switch (marketSignal.signal) {
    case "STRONG_BUY":
      return `Bull strength exceeds bear strength by ${gap} points. The weighted battlefield strongly favors buyers.`;

    case "BUY":
      return `Bull strength exceeds bear strength by ${gap} points. Buyers currently hold the advantage.`;

    case "STRONG_SELL":
      return `Bear strength exceeds bull strength by ${gap} points. The weighted battlefield strongly favors sellers.`;

    case "SELL":
      return `Bear strength exceeds bull strength by ${gap} points. Sellers currently hold the advantage.`;

    default:
      return "Bull and bear strengths are too close for a reliable directional signal.";
  }
}

export function hasSignalChanged(previous, next) {
  if (!previous) {
    return true;
  }

  return (
    previous.signal !== next.signal ||
    previous.longAction !== next.longAction ||
    Math.abs(previous.difference - next.difference) >= 5
  );
}
