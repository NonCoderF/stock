import {
  escapeHtml,
  formatCurrency,
  formatPercent
} from "./paper-format.js";

export function renderPaperWallet(account) {
  const root = document.querySelector("#paper-wallet-card");

  if (!root) {
    return;
  }

  if (!account) {
    root.hidden = true;
    return;
  }

  const invested = account.openPosition?.investedAmount || 0;
  const totalReturn =
    account.initialCapital > 0
      ? ((account.equity - account.initialCapital) / account.initialCapital) * 100
      : 0;

  root.hidden = false;
  root.innerHTML = `
    <header class="paper-panel__header">
      <div>
        <p class="eyebrow">Paper Trading Only</p>
        <h2>Paper Wallet</h2>
      </div>
      <button id="reset-paper-account" type="button" class="secondary-button">
        Reset Paper Account
      </button>
    </header>

    <div class="paper-wallet-grid">
      ${metric("Starting Capital", formatCurrency(account.initialCapital))}
      ${metric("Available Cash", formatCurrency(account.cash))}
      ${metric("Invested", formatCurrency(invested))}
      ${metric("Current Equity", formatCurrency(account.equity))}
      ${metric("Realized P&L", formatCurrency(account.realizedPnl), account.realizedPnl)}
      ${metric("Unrealized P&L", formatCurrency(account.unrealizedPnl), account.unrealizedPnl)}
      ${metric("Total Return", formatPercent(totalReturn), totalReturn)}
    </div>

    <p class="paper-safety-copy">
      PAPER TRADING ONLY | NO REAL ORDER IS PLACED | SIMULATED P&L DOES NOT GUARANTEE REAL-WORLD RESULTS
    </p>
  `;
}

function metric(label, value, toneValue = null) {
  const tone = Number(toneValue) > 0 ? "profit" : Number(toneValue) < 0 ? "loss" : "";
  return `
    <div class="paper-wallet-metric ${tone ? `paper-wallet-metric--${tone}` : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}
