export function renderMarketView(root, context) {
  root.resultShell.hidden = false;
  root.emptyState.hidden = true;
  const request = context.request;
  const entry = context.arenas.find((arena) => arena.role === "ENTRY") || context.arenas[0];
  root.marketFacts.innerHTML = [
    fact("Symbol", request.symbol),
    fact("Exchange", request.exchange),
    fact("Current", money(entry?.signals?.latestPrice, request.exchange)),
    fact("Engine", "Local"),
    fact("Market", context.marketStatus),
    fact("Strategy", context.strategyStatus)
  ].join("");
}

export function renderCapital(root, decision, exchange) {
  const plan = decision.capitalPlan || {};
  if (decision.longAction !== "BUY") {
    root.capitalPlan.innerHTML = `
      <p class="section-label">CAPITAL MISSION</p>
      <h2>CAPITAL PROTECTED</h2>
      <div class="mission-grid">
        ${metric("Capital", money(plan.availableCapital, exchange))}
        ${metric("Deploy", money(0, exchange))}
        ${metric("Reserve", money(plan.availableCapital, exchange))}
        ${metric("Long Action", decision.longAction === "DO_NOT_BUY" ? "DO NOT BUY" : display(decision.longAction))}
      </div>
    `;
    return;
  }

  root.capitalPlan.innerHTML = `
    <p class="section-label">CAPITAL MISSION</p>
    <h2>MISSION</h2>
    <div class="mission-grid">
      ${metric("Capital", money(plan.availableCapital, exchange))}
      ${metric("Deploy", money(plan.allocationAmount, exchange))}
      ${metric("Reserve", money(plan.cashRemaining, exchange))}
      ${metric("Risk", money(plan.maximumNetPlannedLoss, exchange))}
      ${metric("Expected", money(plan.estimatedNetProfit, exchange))}
      ${metric("Net R/R", ratio(plan.rewardRiskRatioNet))}
    </div>
  `;
}

export function renderTiming(root, request, decision) {
  const timing = decision.tradeTiming || {};
  root.timingPlan.innerHTML = `
    <p class="section-label">BATTLE DURATION</p>
    <h2>TIMING DIRECTIVE</h2>
    <div class="metric-grid">
      ${metric("Requested", duration(request.maximumHoldingMinutes))}
      ${metric("Recommended", duration(timing.recommendedMaximumMinutes))}
      ${metric("Decision", title(timing.timingDecision))}
    </div>
  `;
}

export function renderTelemetry(root, metadata) {
  root.telemetry.innerHTML = `
    <span>Market <strong>${latency(metadata.marketMs)}</strong></span>
    <span>AI <strong>${latency(metadata.strategyMs)}</strong></span>
    <span>Total <strong>${latency(metadata.totalMs)}</strong></span>
    <span>Engine <strong>Local</strong></span>
  `;
}

export function fact(label, value) {
  return `<span class="fact">${escape(label)} <strong>${escape(display(value))}</strong></span>`;
}

export function metric(label, value) {
  return `<div class="mission-metric"><span>${escape(label)}</span><strong>${escape(display(value))}</strong></div>`;
}

export function display(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function money(value, exchange) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const symbol = ["NSE", "BSE"].includes(exchange) ? "₹" : "$";
  return `${symbol}${number.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function percent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

export function ratio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number.toFixed(2)}:1`;
}

export function duration(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return "—";
  if (value < 60) return `${value} min`;
  if (value < 1440) return `${value / 60} hr`;
  return `${value / 1440} days`;
}

export function latency(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value)) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

export function title(value) {
  return display(value).toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function escape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
