export function selectSimulationStrategy(strategies) {
  if (!Array.isArray(strategies)) {
    return null;
  }

  const eligible = strategies.find(
    (strategy) => strategy?.simulationPlan?.eligible === true
  );

  if (eligible) {
    return eligible;
  }

  return (
    strategies.find((strategy) => strategy.category === "BEST_OPPORTUNITY") ||
    strategies[0] ||
    null
  );
}

export function reconcileSimulationPlanWithSignal(plan, marketSignal) {
  if (!plan) {
    return null;
  }

  const copy = {
    ...plan
  };

  if (
    marketSignal?.signal === "SELL" ||
    marketSignal?.signal === "STRONG_SELL"
  ) {
    copy.eligible = false;
    copy.status = "NO_SIMULATED_ENTRY";

    copy.rejectionReasons = [
      ...(copy.rejectionReasons || []),
      "Blocked by the local bearish market signal."
    ];
  }

  if (
    marketSignal?.signal === "WAIT" &&
    copy.status === "READY_FOR_SIMULATED_ENTRY"
  ) {
    copy.status = "WAITING_FOR_SIMULATED_TRIGGER";
  }

  return copy;
}

export function getSimulationStatusPresentation(status) {
  switch (status) {
    case "READY_FOR_SIMULATED_ENTRY":
      return {
        label: "READY FOR PAPER ENTRY",
        tone: "ready",
        description: "The plan passed deterministic paper-trade checks."
      };

    case "WAITING_FOR_SIMULATED_TRIGGER":
      return {
        label: "WAITING FOR TRIGGER",
        tone: "waiting",
        description: "The plan is valid, but entry conditions are not active yet."
      };

    case "NO_SIMULATED_ENTRY":
    default:
      return {
        label: "NO PAPER ENTRY",
        tone: "blocked",
        description: "This plan is not eligible for simulated entry."
      };
  }
}

export function renderPaperTradingCard({ strategies, paperTrading }) {
  const root = document.querySelector("#paper-trading-card");

  if (!root) {
    return;
  }

  const strategy = selectSimulationStrategy(strategies);
  const plan = strategy?.simulationPlan || null;

  if (!paperTrading || !strategy || !plan) {
    root.hidden = true;
    return;
  }

  root.hidden = false;

  const status = getSimulationStatusPresentation(plan.status);
  root.dataset.status = status.tone;

  const statusElement = document.querySelector("#paper-trading-status");
  if (statusElement) {
    statusElement.textContent = status.label;
  }

  rpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63(strategy, plan, status, paperTrading);
  renderPaperTradingMetrics(plan, paperTrading);
  renderPaperTradingPlan(plan);
  renderPaperTradingConditions(plan);
  renderPaperTradingDisclaimer(plan, paperTrading);
}

export function rpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63(
  strategy,
  plan,
  status,
  paperTrading
) {
  const container = document.querySelector("#paper-trading-strategy");

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="paper-trading-strategy__summary">
      <div>
        <span class="paper-trading-strategy__label">Selected plan</span>
        <strong class="paper-trading-strategy__title">${escapeHtml(strategy.title)}</strong>
      </div>

      <span class="paper-trading-status-badge paper-trading-status-badge--${escapeHtml(status.tone)}">
        ${escapeHtml(status.label)}
      </span>
    </div>

    <p class="paper-trading-strategy__description">
      ${escapeHtml(status.description)}
    </p>

    <div class="paper-trading-safety" aria-label="Paper trading safety notice">
      <span>SIMULATION ONLY</span>
      <span>NO REAL ORDER PLACED</span>
      <span>PROJECTED P&amp;L IS NOT GUARANTEED</span>
    </div>

    <div class="paper-trading-account">
      <span>Paper trading ${paperTrading.enabled === true ? "enabled" : "disabled"}</span>
      <span>${escapeHtml(paperTrading.mode || plan.mode || "PAPER_ONLY")}</span>
      <span>${escapeHtml(plan.side || "LONG")}</span>
    </div>
  `;
}

export function renderPaperTradingMetrics(plan, paperTrading) {
  const container = document.querySelector("#paper-trading-metrics");

  if (!container) {
    return;
  }

  const metrics = [
    {
      label: "Available capital",
      value: formatCurrency(plan.availableCapital)
    },
    {
      label: "Allocation",
      value: `${formatNumber(plan.appliedAllocationPercent)}%`
    },
    {
      label: "Allocation amount",
      value: formatCurrency(plan.allocationAmount)
    },
    {
      label: "Quantity",
      value: formatInteger(plan.quantity)
    },
    {
      label: "Invested amount",
      value: formatCurrency(plan.investedAmount)
    },
    {
      label: "Cash reserve",
      value: formatCurrency(plan.cashReserve)
    },
    {
      label: "Projected net loss at stop",
      value: formatCurrency(plan.projectedNetLossAtStop),
      tone: "loss"
    },
    {
      label: "Projected net profit at target",
      value: formatCurrency(plan.projectedNetProfitAtTarget),
      tone: "profit"
    },
    {
      label: "Projected return",
      value: `${formatNumber(plan.projectedReturnPercent)}%`
    },
    {
      label: "Net reward:risk",
      value: plan.rewardRiskRatioNet == null ? "—" : formatNumber(plan.rewardRiskRatioNet)
    },
    {
      label: "Maximum holding",
      value: formatHoldingMinutes(plan.maximumHoldingMinutes)
    },
    {
      label: "Account equity",
      value: formatCurrency(paperTrading.equity)
    }
  ];

  container.innerHTML = metrics
    .map(
      (metric) => `
        <div class="paper-trading-metric ${
          metric.tone ? `paper-trading-metric--${metric.tone}` : ""
        }">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
        </div>
      `
    )
    .join("");
}

export function renderPaperTradingPlan(plan) {
  const container = document.querySelector("#paper-trading-plan");

  if (!container) {
    return;
  }

  container.innerHTML = `
    <section class="paper-trading-price-plan">
      <h3>Simulated price plan</h3>

      <div class="paper-trading-price-grid">
        <div>
          <span>Entry</span>
          <strong>${formatOptionalCurrency(plan.entryPrice)}</strong>
        </div>

        <div>
          <span>Stop loss</span>
          <strong>${formatOptionalCurrency(plan.stopLossPrice)}</strong>
        </div>

        <div>
          <span>Target</span>
          <strong>${formatOptionalCurrency(plan.targetPrice)}</strong>
        </div>

        <div>
          <span>Risk per share</span>
          <strong>${formatCurrency(plan.riskPerShare)}</strong>
        </div>

        <div>
          <span>Profit per share</span>
          <strong>${formatCurrency(plan.profitPerShare)}</strong>
        </div>

        <div>
          <span>Gross reward:risk</span>
          <strong>${
            plan.rewardRiskRatioGross == null
              ? "—"
              : escapeHtml(formatNumber(plan.rewardRiskRatioGross))
          }</strong>
        </div>
      </div>
    </section>
  `;
}

export function renderPaperTradingConditions(plan) {
  const container = document.querySelector("#paper-trading-conditions");

  if (!container) {
    return;
  }

  const exitConditions = Array.isArray(plan.exitConditions)
    ? plan.exitConditions
    : [];
  const rejectionReasons = Array.isArray(plan.rejectionReasons)
    ? plan.rejectionReasons
    : [];

  container.innerHTML = `
    <section class="paper-trading-entry-condition">
      <h3>Entry condition</h3>

      <p>${escapeHtml(plan.entryCondition || "No entry condition supplied.")}</p>
    </section>

    ${
      exitConditions.length > 0
        ? `
          <section class="paper-trading-exit-conditions">
            <h3>Exit conditions</h3>

            <ul>
              ${exitConditions
                .map((condition) => `<li>${escapeHtml(condition)}</li>`)
                .join("")}
            </ul>
          </section>
        `
        : ""
    }

    ${
      rejectionReasons.length > 0
        ? `
          <section class="paper-trading-rejections">
            <h3>Why entry is blocked</h3>

            <ul>
              ${rejectionReasons
                .map((reason) => `<li>${escapeHtml(reason)}</li>`)
                .join("")}
            </ul>
          </section>
        `
        : ""
    }
  `;
}

export function renderPaperTradingDisclaimer(plan, paperTrading) {
  const element = document.querySelector("#paper-trading-disclaimer");

  if (!element) {
    return;
  }

  element.textContent =
    plan.disclaimer ||
    paperTrading.disclaimer ||
    "Paper simulation only. No real order is placed.";
}

export function formatCurrency(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(number);
}

export function formatOptionalCurrency(value) {
  const number = Number(value);

  return Number.isFinite(number) ? formatCurrency(number) : "—";
}

export function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toFixed(2);
}

export function formatInteger(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? String(Math.max(0, Math.floor(number)))
    : "0";
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
