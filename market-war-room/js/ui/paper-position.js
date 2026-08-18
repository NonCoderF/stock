import {
  elapsedMinutesSince,
  escapeHtml,
  formatCurrency,
  formatHoldingMinutes,
  formatInteger
} from "./paper-format.js";

export function renderOpenPaperPosition(position) {
  const root = document.querySelector("#paper-position-card");

  if (!root) {
    return;
  }

  root.hidden = false;

  if (!position) {
    root.innerHTML = `
      <header class="paper-panel__header">
        <div>
          <p class="eyebrow">Paper Trading Only</p>
          <h2>Live Paper Position</h2>
        </div>
      </header>
      <p class="muted">No paper position is open.</p>
      <p class="paper-safety-copy">SIMULATION ONLY | NO REAL ORDER PLACED</p>
    `;
    return;
  }

  root.innerHTML = `
    <header class="paper-panel__header">
      <div>
        <p class="eyebrow">Paper Trading Only</p>
        <h2>Live Paper Position</h2>
      </div>
      <button id="close-paper-position" type="button" class="secondary-button">
        Close Paper Position
      </button>
    </header>

    <div class="paper-position-grid">
      ${metric("Symbol", `${position.exchange}:${position.symbol}`)}
      ${metric("Side", position.side)}
      ${metric("Quantity", formatInteger(position.quantity))}
      ${metric("Entry", formatCurrency(position.entryPrice))}
      ${metric("Current", formatCurrency(position.currentPrice))}
      ${metric("Stop", formatCurrency(position.stopLoss))}
      ${metric("Target", formatCurrency(position.targetPrice))}
      ${metric("Invested", formatCurrency(position.investedAmount))}
      ${metric("Unrealized P&L", formatCurrency(position.unrealizedPnl), position.unrealizedPnl)}
      ${metric("Elapsed Time", elapsedMinutesSince(position.openedAt))}
      ${metric("Maximum Holding", formatHoldingMinutes(position.maximumHoldingMinutes))}
      ${metric("Source Signal", position.sourceSignal)}
      ${metric("Source", position.strategyTitle)}
    </div>

    <p class="paper-safety-copy">SIMULATION ONLY | NO REAL ORDER PLACED</p>
  `;
}

function metric(label, value, toneValue = null) {
  const tone = Number(toneValue) > 0 ? "profit" : Number(toneValue) < 0 ? "loss" : "";
  return `
    <div class="paper-position-metric ${tone ? `paper-position-metric--${tone}` : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}
