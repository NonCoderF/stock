import { PAPER_RISK_POLICIES } from "./risk-policy.js";
import { persistPaperAccount } from "../state/paper-account.js";

export const EXIT_LABELS = {
  STOP_LOSS: "Stop Loss",
  TARGET_REACHED: "Target Reached",
  LOCAL_SIGNAL_FLIPPED_BEARISH: "Signal Turned Bearish",
  MAXIMUM_HOLDING_TIME: "Time Exit",
  MANUAL_PAPER_EXIT: "Manual Exit"
};

export function determinePaperExit({
  position,
  currentPrice,
  marketSignal,
  now
}) {
  if (!position) {
    return {
      shouldExit: false,
      reason: null
    };
  }

  const price = Number(currentPrice);
  const timeOnly = position.exitMode === "TIME_ONLY";

  if (!timeOnly && Number.isFinite(price) && price <= position.stopLoss) {
    return {
      shouldExit: true,
      reason: "STOP_LOSS"
    };
  }

  if (!timeOnly && Number.isFinite(price) && price >= position.targetPrice) {
    return {
      shouldExit: true,
      reason: "TARGET_REACHED"
    };
  }

  if (!timeOnly && ["SELL", "STRONG_SELL"].includes(marketSignal?.signal)) {
    return {
      shouldExit: true,
      reason: "LOCAL_SIGNAL_FLIPPED_BEARISH"
    };
  }

  const elapsedMinutes =
    (new Date(now).getTime() - new Date(position.openedAt).getTime()) / 60000;

  if (elapsedMinutes >= position.maximumHoldingMinutes) {
    return {
      shouldExit: true,
      reason: "MAXIMUM_HOLDING_TIME"
    };
  }

  return {
    shouldExit: false,
    reason: null
  };
}

export function closePaperPosition({
  account,
  exitPrice,
  reason,
  riskProfile
}) {
  const position = account.openPosition;

  if (!position) {
    return null;
  }

  const price = Number(exitPrice);

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  const policy =
    PAPER_RISK_POLICIES[riskProfile] || PAPER_RISK_POLICIES.CONTROLLED;
  const exitValue = position.quantity * price;
  const estimatedExitCosts =
    exitValue * (policy.estimatedChargesPercent / 100);
  const estimatedSlippage =
    position.investedAmount * (policy.estimatedSlippagePercent / 100);
  const grossPnl = (price - position.entryPrice) * position.quantity;
  const netPnl =
    grossPnl -
    position.estimatedEntryCosts -
    estimatedExitCosts -
    estimatedSlippage;

  account.cash += exitValue - estimatedExitCosts - estimatedSlippage;
  account.realizedPnl += netPnl;

  const closedTrade = {
    ...position,
    exitPrice: price,
    exitReason: reason,
    closedAt: new Date().toISOString(),
    grossPnl,
    estimatedExitCosts,
    estimatedSlippage,
    netPnl,
    returnPercent:
      position.investedAmount > 0 ? (netPnl / position.investedAmount) * 100 : 0
  };

  account.trades.unshift(closedTrade);
  account.openPosition = null;
  account.unrealizedPnl = 0;
  account.equity = account.cash;

  persistPaperAccount(account);

  return closedTrade;
}
