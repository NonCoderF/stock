import { EXIT_LABELS } from "../engine/paper-exit.js";
import {
  escapeHtml,
  formatCurrency,
  formatInteger,
  formatPercent
} from "./paper-format.js";

export function renderPaperTradeHistory(trades) {
  const root = document.querySelector("#paper-trade-history-card");

  if (!root) {
    return;
  }

  const history = Array.isArray(trades) ? trades : [];
  root.hidden = false;
  root.innerHTML = `
    <header class="paper-panel__header">
      <div>
        <p class="eyebrow">Paper Trading Only</p>
        <h2>Paper Trade History</h2>
      </div>
    </header>

    ${
      history.length
        ? `
          <div class="paper-history-table-wrap">
            <table class="paper-history-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>Qty</th>
                  <th>Gross P&L</th>
                  <th>Net P&L</th>
                  <th>Return</th>
                  <th>Exit Reason</th>
                  <th>Opened</th>
                  <th>Closed</th>
                </tr>
              </thead>
              <tbody>
                ${history.map(renderTrade).join("")}
              </tbody>
            </table>
          </div>
        `
        : `<p class="muted">No closed paper trades yet.</p>`
    }
  `;
}

function renderTrade(trade) {
  return `
    <tr>
      <td>${escapeHtml(trade.symbol)}</td>
      <td>${escapeHtml(formatCurrency(trade.entryPrice))}</td>
      <td>${escapeHtml(formatCurrency(trade.exitPrice))}</td>
      <td>${escapeHtml(formatInteger(trade.quantity))}</td>
      <td>${escapeHtml(formatCurrency(trade.grossPnl))}</td>
      <td>${escapeHtml(formatCurrency(trade.netPnl))}</td>
      <td>${escapeHtml(formatPercent(trade.returnPercent))}</td>
      <td>${escapeHtml(EXIT_LABELS[trade.exitReason] || trade.exitReason)}</td>
      <td>${escapeHtml(formatTime(trade.openedAt))}</td>
      <td>${escapeHtml(formatTime(trade.closedAt))}</td>
    </tr>
  `;
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : "\u2014";
}
