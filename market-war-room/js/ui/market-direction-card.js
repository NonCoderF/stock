import { directionLabel } from "../analysis/scoring/direction-score.js";
import { display, escape } from "./market-view.js";

export function renderMarketDirectionCard(root, analysis) {
  if (!root.marketDirectionCard) return;
  root.marketDirectionCard.hidden = false;

  if (!analysis || analysis.status === "INSUFFICIENT_DATA") {
    root.marketDirectionCard.innerHTML = `
      <p class="section-label">MARKET DIRECTION</p>
      <h2>INSUFFICIENT DATA</h2>
      <p class="muted">${escape(analysis?.summary || "The analyzer needs more candles before it can calculate a technical direction.")}</p>
      <div class="mission-grid">
        ${metric("Candles", `${analysis?.candleCount ?? 0} / ${analysis?.preferredCandleCount ?? 100}`)}
        ${metric("Confidence", "LOW")}
      </div>
    `;
    return;
  }

  const rows = [analysis.structureIndicator, ...analysis.indicators].filter(Boolean);

  root.marketDirectionCard.innerHTML = `
    <div class="direction-card-head">
      <div>
        <p class="section-label">INDICATOR DIRECTION</p>
        <h2>${escape(directionLabel(analysis.direction))}</h2>
      </div>
      <div class="direction-score" data-direction="${escape(analysis.direction)}">
        <span>Score</span>
        <strong>${escape(formatSigned(analysis.directionScore))} / ${analysis.maxDirectionScore}</strong>
      </div>
    </div>

    <div class="direction-overview">
      ${metric("Signal Confidence", title(analysis.confidence))}
      ${metric("Candles", `${analysis.candleCount}${analysis.candleCount < analysis.preferredCandleCount ? " / 100 preferred" : ""}`)}
      ${metric("Candle Mode", analysis.includesCurrentCandle ? "Latest included" : "Closed candles only")}
    </div>

    ${renderRelatedConfirmation(analysis.relatedConfirmation)}

    <div class="direction-summary">
      <strong>Simple Read</strong>
      <p>${escape(analysis.summary)}</p>
    </div>

    <div class="direction-grid">
      ${rows.map(renderIndicator).join("")}
      ${renderAdx(analysis.adx)}
      ${renderAtr(analysis.atr)}
    </div>

    ${analysis.warnings.length ? `
      <div class="direction-warnings">
        ${analysis.warnings.map((item) => `<span>${escape(item)}</span>`).join("")}
      </div>
    ` : ""}

    <details class="score-debug">
      <summary>Why did I get this score?</summary>
      <div class="score-debug-grid">
        ${analysis.debugRows.map(([label, score]) => `
          <span>${escape(label)}</span><strong>${escape(formatSigned(score))}</strong>
        `).join("")}
        <span>Total</span><strong>${escape(formatSigned(analysis.directionScore))}</strong>
      </div>
    </details>
  `;
}

function renderIndicator(indicator) {
  return `
    <article class="direction-indicator" data-signal="${escape(indicator.signal)}">
      <div>
        <h3>${escape(indicator.name)}</h3>
        <strong>${escape(display(indicator.value))}</strong>
      </div>
      <span>${escape(indicator.signal)}</span>
      <p>${escape(indicator.explanation)}</p>
    </article>
  `;
}

function renderAdx(adx) {
  const diText = Number.isFinite(Number(adx?.plusDI)) && Number.isFinite(Number(adx?.minusDI))
    ? `+DI ${adx.plusDI} / -DI ${adx.minusDI}`
    : "DI unavailable";
  return `
    <article class="direction-indicator" data-signal="${escape(adx?.direction || "NEUTRAL")}">
      <div>
        <h3>ADX</h3>
        <strong>${escape(display(adx?.value))}</strong>
      </div>
      <span>${escape(adx?.strength || "Insufficient data")}</span>
      <p>${escape(`${adx?.strength || "Trend strength unavailable"}. ${diText}. ADX is context only and does not add direction points.`)}</p>
    </article>
  `;
}

function renderAtr(atr) {
  return `
    <article class="direction-indicator" data-signal="NEUTRAL">
      <div>
        <h3>ATR</h3>
        <strong>${escape(display(atr?.value))}</strong>
      </div>
      <span>${escape(atr?.volatility || "Insufficient data")}</span>
      <p>${escape(`ATR is ${display(atr?.percent)}% of price. ATR reports volatility only and does not add bull or bear points.`)}</p>
    </article>
  `;
}

function renderRelatedConfirmation(confirmation) {
  if (!confirmation) return "";

  return `
    <section class="related-confirmation" data-verdict="${escape(confirmation.verdict)}">
      ${renderStockSearch(confirmation.searchRanking)}
      <div class="related-confirmation__head">
        <div>
          <p class="section-label">RELATED STOCKS</p>
          <h3>${escape(relatedTitle(confirmation.verdict))}</h3>
        </div>
        <strong>${escape(`${confirmation.alignedCount}/${confirmation.successfulCount}`)} align</strong>
      </div>
      <p>${escape(confirmation.summary)}</p>
      <div class="related-symbol-grid">
        ${confirmation.symbols.map((item) => `
          <article class="related-symbol" data-direction="${escape(item.direction || "UNKNOWN")}">
            <span>${escape(item.symbol)}</span>
            <strong>${escape(item.directionLabel)}</strong>
            <small>${escape(item.score === null ? item.message || "Unavailable" : `Score ${formatSigned(item.score)} / 7`)}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderStockSearch(ranking) {
  const rows = (Array.isArray(ranking) ? ranking : []).slice(0, 5);
  if (!rows.length) return "";
  const symbols = rows.map((item) => item.symbol).filter(Boolean).join(",");

  return `
    <div class="stock-search">
      <div class="related-confirmation__head">
        <div>
          <p class="section-label">STOCK SEARCH</p>
          <h3>Highest intraday margin</h3>
        </div>
        <strong>Top ${rows.length}</strong>
      </div>
      <div class="stock-search-grid">
        ${rows.map((item) => `
          <article class="stock-search-item" role="button" tabindex="0" data-symbol="${escape(item.symbol)}" data-symbols="${escape(symbols)}" data-direction="${escape(item.direction || "UNKNOWN")}">
            <span>#${escape(item.rank)} ${escape(item.symbol)}${item.role === "MAIN" ? " MAIN" : ""}</span>
            <strong>${escape(String(item.searchScore))}</strong>
            <em>Margin ${escape(formatPercent(item.intradayMarginPercent))}</em>
            <small>${escape(item.reason)}</small>
            <button class="stock-select-button" type="button" tabindex="-1">Use</button>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function relatedTitle(verdict) {
  if (verdict === "CONFIRMED") return "Direction confirmed by related stocks";
  if (verdict === "PARTLY_CONFIRMED") return "Direction partly confirmed";
  if (verdict === "CONFLICTING") return "Related stocks conflict";
  if (verdict === "MAIN_NEUTRAL") return "Related stocks are context";
  return "Related stocks are mixed";
}

function metric(label, value) {
  return `<div class="mission-metric"><span>${escape(label)}</span><strong>${escape(display(value))}</strong></div>`;
}

function formatSigned(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number > 0 ? `+${number}` : String(number);
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number.toFixed(2)}%`;
}

function title(value) {
  return display(value).toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}
