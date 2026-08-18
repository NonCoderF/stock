import { updatePaperMarkToMarket } from "./paper-pnl.js";
import { closePaperPosition, determinePaperExit } from "./paper-exit.js";
import { persistPaperAccount } from "../state/paper-account.js";

export function updatePaperSimulator({
  account,
  currentPrice,
  marketSignal,
  riskProfile
}) {
  if (!account || !Number.isFinite(Number(currentPrice))) {
    return {
      account,
      closedTrade: null
    };
  }

  updatePaperMarkToMarket({
    account,
    currentPrice
  });

  let closedTrade = null;
  const position = account.openPosition;

  if (position) {
    const exit = determinePaperExit({
      position,
      currentPrice,
      marketSignal,
      now: new Date().toISOString()
    });

    if (exit.shouldExit) {
      closedTrade = closePaperPosition({
        account,
        exitPrice: currentPrice,
        reason: exit.reason,
        riskProfile
      });
    }
  }

  persistPaperAccount(account);

  return {
    account,
    closedTrade
  };
}
