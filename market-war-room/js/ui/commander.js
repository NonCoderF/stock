import { display, escape, metric, percent, title } from "./market-view.js";

export function renderCommander(root, decision) {
  const signal = decision.marketSignal;
  const action = actionPresentation(decision.action, signal);

  root.commanderHero.innerHTML = `
    <div class="hero-frame commander" data-signal="${escape(signal?.signal || "WAIT")}">
      <h2>COMMANDER</h2>
      <div class="hero-action ${action.className}">${escape(action.label)}</div>
      <blockquote><span>${escape(decision.summary)}</span></blockquote>
      <div class="hero-meta">
        <span>Signal Confidence</span>
        <strong>${escape(percent(decision.confidence))}</strong>
      </div>
    </div>
  `;

  root.commanderCard.innerHTML = `
    <div class="commander" data-signal="${escape(signal?.signal || "WAIT")}">
      <p class="section-label">COMMANDER</p>
      <h2>${escape(action.label)}</h2>
      <div class="commander-brief">
        ${metric("Signal", formatSignal(signal?.signal || decision.action))}
        ${metric("Long Action", formatLongAction(signal?.longAction || decision.action))}
        ${metric("Signal Confidence", percent(decision.confidence))}
        ${metric("Bull-Bear Difference", signal?.difference)}
      </div>
      <div class="ai-speech"><span>${escape(display(decision.summary))}</span></div>
      ${signal ? renderWhySignal(signal) : ""}
    </div>
  `;
}

export function renderWhySignal(signal) {
  return `
    <section class="why-signal">
      <h3>WHY THIS SIGNAL</h3>
      <div class="command-lines">
        <span><strong>Bulls</strong>${escape(display(signal.bullStrength))}</span>
        <span><strong>Bears</strong>${escape(display(signal.bearStrength))}</span>
        <span><strong>Difference</strong>${escape(display(signal.difference))}</span>
        <span><strong>Weighted Campaign</strong>${escape(display(signal.campaignDominance))}</span>
        <span><strong>Entry</strong>${escape(display(signal.entryWinner))}</span>
        <span><strong>Confirmation</strong>${escape(display(signal.confirmationWinner))}</span>
        <span><strong>Context</strong>${escape(display(signal.contextWinner))}</span>
        ${signal.warnings?.length ? `<span><strong>Warnings</strong>${escape(signal.warnings.join(" "))}</span>` : ""}
      </div>
    </section>
  `;
}

export function actionPresentation(action, marketSignal) {
  if (marketSignal?.signal === "STRONG_BUY") {
    return { label: marketSignal.headline || "JOIN THE BULLS", shortLabel: "STRONG BUY", className: "buy" };
  }
  if (marketSignal?.signal === "BUY") {
    return { label: marketSignal.headline || "BULLS HAVE THE EDGE", shortLabel: "BUY", className: "buy" };
  }
  if (marketSignal?.signal === "STRONG_SELL") {
    return { label: marketSignal.headline || "BEARS CONTROL THE FIELD", shortLabel: "STRONG SELL", className: "no-trade" };
  }
  if (marketSignal?.signal === "SELL") {
    return { label: marketSignal.headline || "STAY AWAY FROM LONGS", shortLabel: "SELL", className: "no-trade" };
  }
  if (marketSignal?.signal === "WAIT") {
    return { label: marketSignal.headline || "NO CLEAR WINNER", shortLabel: "WAIT", className: "wait" };
  }
  if (action === "BUY") return { label: "JOIN THE BULLS", shortLabel: "BUY", className: "buy" };
  if (action === "EXIT_IF_HELD") return { label: "LEAVE THE ARENA", shortLabel: "EXIT IF HELD", className: "exit" };
  if (action === "WAIT") return { label: "STAY IN THE STANDS", shortLabel: "WAIT", className: "wait" };
  return { label: "DO NOT BID", shortLabel: "NO TRADE", className: "no-trade" };
}

function formatSignal(value) {
  return title(value);
}

function formatLongAction(value) {
  if (value === "DO_NOT_BUY") return "DO NOT BUY";
  return title(value);
}
