import { PAPER_RISK_POLICIES } from "./risk-policy.js";
import { persistPaperAccount } from "../state/paper-account.js";

export function openSimplePaperPosition({
  account,
  currentPrice,
  riskProfile,
  symbol,
  exchange,
  marketSignal,
  maximumHoldingMinutes
}) {
  const policy =
    PAPER_RISK_POLICIES[riskProfile] || PAPER_RISK_POLICIES.CONTROLLED;
  const entryPrice = Number(currentPrice);

  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return {
      opened: false,
      reasons: ["Fresh market quote is unavailable."],
      position: null
    };
  }

  if (account?.openPosition) {
    return {
      opened: false,
      reasons: ["A paper position is already open."],
      position: null
    };
  }

  const quantity = 1;
  const investedAmount = quantity * entryPrice;
  const estimatedEntryCosts =
    investedAmount * (policy.estimatedChargesPercent / 100);
  const totalDebit = investedAmount + estimatedEntryCosts;

  if (!account || totalDebit > account.cash) {
    return {
      opened: false,
      reasons: ["Insufficient paper cash to buy one share at the latest quote."],
      position: null
    };
  }

  const position = {
    id: createPositionId(),
    symbol,
    exchange,
    side: "LONG",
    strategyId: "MANUAL_BUY_NOW",
    strategyTitle: "Buy now and hold",
    sourceSignal: marketSignal?.signal || "MANUAL",
    exitMode: "TIME_ONLY",
    quantity,
    entryPrice,
    currentPrice: entryPrice,
    stopLoss: null,
    targetPrice: null,
    allocationPercent: null,
    investedAmount,
    estimatedEntryCosts,
    openedAt: new Date().toISOString(),
    maximumHoldingMinutes: Number(maximumHoldingMinutes) || 0,
    unrealizedPnl: 0,
    marketValue: investedAmount
  };

  account.cash -= totalDebit;
  account.openPosition = position;
  account.unrealizedPnl = 0;
  account.equity = account.cash + investedAmount;

  persistPaperAccount(account);

  return {
    opened: true,
    reasons: [],
    position
  };
}

function createPositionId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return [
    Date.now().toString(16),
    Math.random().toString(16).slice(2)
  ].join("-");
}
