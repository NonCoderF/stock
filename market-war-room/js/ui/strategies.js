export function renderStrategyStatus(root, status) {
  const container = root.strategyCommandCenter;
  container.hidden = false;
  container.innerHTML = strategyShell(`
    <div class="strategy-loading-state">
      ${escapeHtml(status)}
    </div>
    <button type="button" class="secondary" id="retryCommanderButton">Retry Commander</button>
  `, "Thinking");
}

export function renderStrategyError(root, error) {
  const container = root.strategyCommandCenter;
  container.hidden = false;
  container.innerHTML = strategyShell(`
    <div class="strategy-error-state">
      <h3>COMMANDER TEMPORARILY UNAVAILABLE</h3>
      <p>The market battlefield remains available.</p>
      <details>
        <summary>Technical details</summary>
        <pre>${escapeHtml(error?.message || error)}</pre>
      </details>
      <button type="button" class="secondary" id="retryCommanderButton">Retry Commander</button>
    </div>
  `, "Unavailable");
}

export function renderStrategies(root, strategies, metadata = {}) {
  renderHumanReadableStrategies(root, strategies, metadata);
}

export function renderHumanReadableStrategies(root, strategies, metadata = {}) {
  const container = root.strategyCommandCenter;

  if (!Array.isArray(strategies) || strategies.length === 0) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  const ordered = [...strategies].sort((a, b) => Number(a.id) - Number(b.id));
  const openAI = metadata?.latencyMs?.openAI;
  const latency = Number.isFinite(Number(openAI))
    ? `<span class="strategy-latency">AI generation ${formatLatency(openAI)}</span>`
    : "";

  container.hidden = false;
  container.innerHTML = strategyShell(`
    ${latency}
    <div id="strategy-missions" class="strategy-missions">
      ${ordered.map(renderHumanReadableStrategyCard).join("")}
    </div>
    <p class="strategy-disclaimer">
      AI-generated plans are uncalibrated model assessments, not guarantees.
      No order is placed by this application.
    </p>
  `, "Ready");
}

export function renderHumanReadableStrategyCard(strategy) {
  const category = getCategoryPresentation(strategy.category);
  const action = getActionPresentation(strategy.action);
  const reasons = Array.isArray(strategy.why) ? strategy.why : [];
  const stopLoss = displayPlanText(strategy.stopLoss);
  const target = displayPlanText(strategy.target);
  const override = strategy.engineOverride;
  const status = override?.applied ? overrideStatusLabel(override.status) : "COMPATIBLE";

  return `
    <article class="strategy-mission strategy-mission--${escapeHtml(category.tone)}">
      <header class="strategy-mission__header">
        <div>
          <div class="strategy-mission__category">${escapeHtml(category.label)}</div>
          <div class="strategy-mission__subtitle">${escapeHtml(category.subtitle)}</div>
        </div>
        <span class="strategy-action strategy-action--${escapeHtml(action.tone)}">
          ${escapeHtml(action.label)}
        </span>
      </header>
      <div class="strategy-compatibility ${override?.applied ? "is-overridden" : ""}">
        ${override?.applied ? "LOCAL ENGINE OVERRIDE" : "LOCAL ENGINE"}
        <strong>${escapeHtml(status)}</strong>
      </div>

      <h3 class="strategy-mission__title">${escapeHtml(strategy.title)}</h3>

      <div class="strategy-mission__metrics">
        <div>
          <span>AI setup estimate</span>
          <strong>${escapeHtml(formatConfidence(strategy.confidence))}</strong>
          <small>Uncalibrated model estimate</small>
        </div>
        <div>
          <span>Risk</span>
          <strong>${escapeHtml(formatRiskLevel(strategy.riskLevel))}</strong>
        </div>
        <div>
          <span>Holding</span>
          <strong>${escapeHtml(formatHoldingMinutes(strategy.holdingMinutes))}</strong>
        </div>
      </div>

      <dl class="strategy-mission__plan">
        <div>
          <dt>Entry</dt>
          <dd>${escapeHtml(strategy.entry)}</dd>
        </div>
        ${stopLoss ? `
          <div>
            <dt>Stop loss</dt>
            <dd>${escapeHtml(stopLoss)}</dd>
          </div>
        ` : ""}
        ${target ? `
          <div>
            <dt>Target</dt>
            <dd>${escapeHtml(target)}</dd>
          </div>
        ` : ""}
      </dl>

      ${reasons.length > 0 ? `
        <section class="strategy-mission__why">
          <h4>Why this plan</h4>
          <ul>
            ${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
          </ul>
        </section>
      ` : ""}

      <p class="strategy-mission__summary">${escapeHtml(strategy.summary)}</p>
      ${override?.reason ? `<p class="strategy-mission__notice">${escapeHtml(override.reason)}</p>` : ""}
      <p class="strategy-mission__notice">Uncalibrated AI estimate. No order is placed.</p>
    </article>
  `;
}

export function getCategoryPresentation(category) {
  switch (category) {
    case "BEST_OPPORTUNITY":
      return {
        label: "BEST OPPORTUNITY",
        subtitle: "Highest-conviction current plan",
        tone: "primary"
      };

    case "SAFER_ALTERNATIVE":
      return {
        label: "SAFER ALTERNATIVE",
        subtitle: "Lower-risk or more patient setup",
        tone: "safe"
      };

    case "CAPITAL_PROTECTION":
    default:
      return {
        label: "CAPITAL PROTECTION",
        subtitle: "Defensive plan focused on survival",
        tone: "defensive"
      };
  }
}

export function getActionPresentation(action) {
  switch (action) {
    case "BUY_NOW":
      return {
        label: "BUY NOW",
        tone: "bull"
      };

    case "WAIT":
      return {
        label: "WAIT",
        tone: "balanced"
      };

    case "SKIP":
    default:
      return {
        label: "SKIP",
        tone: "bear"
      };
  }
}

export function formatRiskLevel(riskLevel) {
  switch (riskLevel) {
    case "VERY_LOW":
      return "Very Low";

    case "LOW":
      return "Low";

    case "MODERATE":
      return "Moderate";

    case "HIGH":
      return "High";

    default:
      return "Unknown";
  }
}

export function formatHoldingMinutes(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "No position";
  }

  return `${number} min`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function strategyShell(content, status) {
  return `
    <header class="section-header">
      <div>
        <p class="eyebrow">Strategy Engine</p>
        <h2 id="strategy-command-center-title">Commander Missions</h2>
        <p>Best opportunity, safer alternative, and capital-protection plan.</p>
      </div>
      <div id="strategy-engine-status" class="engine-status" aria-live="polite">
        ${escapeHtml(status)}
      </div>
    </header>
    <p class="muted">Three AI-generated paths for the current battlefield.</p>
    ${content}
  `;
}

function displayPlanText(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return "";
  return text;
}

function formatConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number}%`;
}

function formatLatency(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value)) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

function overrideStatusLabel(status) {
  if (status === "DOWNGRADED_TO_WAIT") return "DOWNGRADED TO WAIT";
  if (status === "REJECTED_BY_BEARISH_SIGNAL") return "REJECTED BY BEARISH SIGNAL";
  return "ENGINE OVERRIDE";
}
