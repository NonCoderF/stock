import { escape, display } from "./market-view.js";

export function renderChart(root, candles) {
  const points = (candles || []).filter((candle) => Number.isFinite(candle.close));
  if (!points.length) {
    root.chartSection.innerHTML = `<p class="section-label">CHARTS</p><h2>PRICE TRACE</h2><div class="current-price-focus"><span>Current Price</span><strong>—</strong></div><div class="chart-empty">Price history unavailable</div>`;
    return;
  }
  const width = 700;
  const height = 190;
  const min = Math.min(...points.map((point) => point.close));
  const max = Math.max(...points.map((point) => point.close));
  const range = max === min ? 1 : max - min;
  const path = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * (width - 20) + 10;
    const y = 10 + ((max - point.close) / range) * (height - 25);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const current = points[points.length - 1]?.close;
  root.chartSection.innerHTML = `
    <p class="section-label">CHARTS</p>
    <h2>PRICE TRACE</h2>
    <div class="current-price-focus"><span>Current Price</span><strong>${escape(display(current?.toFixed?.(2) || current))}</strong></div>
    <div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Returned candle close chart"><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2"></path></svg></div>
  `;
}
