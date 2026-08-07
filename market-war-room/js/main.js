import { fetchAllArenas } from "./api/market-api.js";
import { fetchHumanReadableStrategies } from "./api/analyze-market-api.js";
import { buildArenaEvidence } from "./engine/arena-evidence.js";
import { chooseArenas } from "./engine/arena-selector.js";
import { buildCampaign } from "./engine/campaign.js";
import {
  buildLocalSignalExplanation,
  calculateSignalConfidence,
  determineMarketSignal,
  getCommanderPresentation,
  hasSignalChanged,
  reconcileStrategiesWithSignal
} from "./engine/market-signal.js";
import { buildCapitalPlan } from "./engine/risk-policy.js";
import { state, appendObservation, resetForRequest } from "./state/app-state.js";
import { evidenceFingerprint, getCache, setCache } from "./state/cache.js";
import { scheduleLoop, stopLoop } from "./state/live-observer.js";
import {
  nextRunningManObservation,
  persistRunningManClientState,
  renderRunningManStatus,
  restoreRunningManClientState,
  startRunningManSession
} from "./state/running-man.js";
import { renderArenas, renderBattle } from "./ui/arenas.js";
import { renderChart } from "./ui/chart.js";
import { renderCommander } from "./ui/commander.js";
import { clearError, renderError } from "./ui/errors.js";
import { renderCapital, renderMarketView, renderTelemetry, renderTiming } from "./ui/market-view.js";
import {
  reconcileSimulationPlanWithSignal,
  renderPaperTradingCard,
  selectSimulationStrategy
} from "./ui/paper-trading.js";
import { renderStrategies, renderStrategyError, renderStrategyStatus } from "./ui/strategies.js";
import { renderTimeline } from "./ui/timeline.js";

const HOLDING_OPTIONS = {
  "5_MINUTES": 5,
  "15_MINUTES": 15,
  "30_MINUTES": 30,
  "1_HOUR": 60,
  "4_HOURS": 240,
  "MARKET_CLOSE": 390,
  "1_DAY": 1440,
  "3_DAYS": 4320,
  "1_WEEK": 10080,
  "1_MONTH": 43200
};
const SUPPORTED_EXCHANGES = ["NSE", "BSE", "NASDAQ", "NYSE", "YAHOO"];
const SUPPORTED_RISKS = ["CONSERVATIVE", "CONTROLLED", "AGGRESSIVE"];
const POLL_INTERVALS = [0, 1000, 3000, 5000, 7000, 9000, 11000];
const STORAGE_REQUEST = "market-war-room:last-request";
const STORAGE_RESPONSE = "market-war-room:last-response";
const STORAGE_STRATEGIES = "market-war-room:last-strategies";

let fetchClockTimer = null;
const root = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  restoreRunningManClientState();
  renderRunningManStatus(state.runningMan.lastPersistence);
  restoreSession();
  updateCurrency();
});

function cacheElements() {
  [
    "analysisForm", "symbol", "exchange", "capital", "riskProfile", "holdingPeriod", "pollInterval",
    "currencySymbol", "runButton", "cancelButton", "loadingPanel", "loadingText", "errorPanel",
    "emptyState", "resultShell", "marketFacts", "commanderHero", "commanderCard", "battleCard",
    "arenasSection", "capitalPlan", "timingPlan", "chartSection", "reasoningSection", "sessionStatus",
    "timelineSection", "newsSection", "failedArenas", "strategyCommandCenter", "telemetry", "feedStatusText",
    "new-running-man-run"
  ].forEach((id) => {
    root[id] = document.getElementById(id);
  });
}

function bindEvents() {
  root.analysisForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const request = buildRequest();
    if (!validateRequest(request)) return;
    stopLoop(state);
    prepareRunningManForRequest(request);
    state.live = true;
    observe(request, { background: false });
  });
  root.cancelButton.addEventListener("click", () => stopObservation());
  root["new-running-man-run"]?.addEventListener("click", () => {
    startRunningManSession();
    renderRunningManStatus(null);
  });
  root.strategyCommandCenter.addEventListener("click", (event) => {
    if (event.target?.id === "retryCommanderButton") retryCommander();
  });
  root.symbol.addEventListener("input", () => {
    const start = root.symbol.selectionStart;
    root.symbol.value = root.symbol.value.toUpperCase();
    root.symbol.setSelectionRange(start, start);
  });
  root.exchange.addEventListener("change", updateCurrency);
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") root.analysisForm.requestSubmit();
    if (event.key === "Escape") stopObservation();
  });
}

async function observe(request, options = {}) {
  const background = options.background === true;
  const started = performance.now();
  const controller = new AbortController();
  resetForRequest(request, controller);
  setLoading(true, "Market engine fetching arenas", { quiet: background });
  try {
    clearError(root);
    renderEngineStatus("Market Engine: fetching arenas in parallel", "Strategy Engine: waiting");
    const marketStarted = performance.now();
    const arenaDefinitions = chooseArenas(request.maximumHoldingMinutes);
    const marketResult = await fetchAllArenas(request, arenaDefinitions, controller.signal);
    const marketResults = marketResult.successful;
    const arenas = marketResults.map((result) => buildArenaEvidence(result.arena, result.candles));
    const entryArena = arenas.find((arena) => arena.role === "ENTRY") || arenas[0];
    const confirmationArena = arenas.find((arena) => arena.role === "CONFIRMATION");
    const contextArena = arenas.find((arena) => arena.role === "CONTEXT");
    const entryMarketResult = marketResults.find((result) => result.arena.role === entryArena?.role) || marketResults[0];
    const campaign = buildCampaign(arenas);
    const marketSignal = determineMarketSignal({
      bullStrength: campaign.bullStrength,
      bearStrength: campaign.bearStrength,
      campaign,
      entryArena,
      confirmationArena,
      contextArena
    });
    const signalChanged = hasSignalChanged(state.signal.current, marketSignal);
    state.signal.previous = state.signal.current;
    state.signal.current = marketSignal;
    if (signalChanged) state.signal.changedAt = new Date().toISOString();
    const capitalPlan = buildCapitalPlan(request, campaign, entryArena);
    const decision = buildDecision(marketSignal, campaign, capitalPlan, request);
    const market = {
      arenas,
      candles: entryMarketResult?.candles || [],
      quote: entryMarketResult?.quote || {},
      company: entryMarketResult?.company || {},
      news: marketResults.flatMap((result) => result.news || []).slice(0, request.newsCount),
      failedArenas: marketResult.failed
    };
    state.marketStatus = "SUCCESS";
    state.strategyStatus = "DESIGNING";
    state.strategy = {
      status: "LOADING",
      strategies: state.strategy?.strategies || [],
      selectedSimulationStrategy: state.strategy?.selectedSimulationStrategy || null,
      paperTrading: state.strategy?.paperTrading || null,
      metadata: state.strategy?.metadata || null,
      error: null
    };
    state.market = market;
    state.decision = decision;
    state.lastUpdatedAt = new Date();
    renderMarketStage({ request, market, decision, marketMs: performance.now() - marketStarted, totalMs: performance.now() - started });
    const evidence = buildCompactEvidence(request, market, decision);
    state.lastEvidence = evidence;
    const fingerprint = evidenceFingerprint(evidence, evidence.quote);
    const cached = getCache(`strategy:${fingerprint}`);
    const runningManObservation = nextRunningManObservation();
    const analyzePayload = buildAnalyzeMarketPayload({
      request,
      quote: evidence.quote,
      evidence,
      relevantNews: evidence.relevantNews,
      runningMan: runningManObservation
    });
    let latestPersistence = null;
    if (cached && Array.isArray(cached.strategies) && cached.strategies.length === 3) {
      state.strategyStatus = "CACHED";
      latestPersistence = {
        runId: runningManObservation.runId,
        observationNo: runningManObservation.observationNo,
        status: "SKIPPED",
        persistedAt: null
      };
      const reconciled = reconcileStrategiesWithSignal(cached.strategies, marketSignal);
      const paperContext = buildPaperTradingContext(reconciled, cached.paperTrading, cached.metadata, marketSignal);
      const changed = strategiesChanged(state.strategy?.strategies, reconciled);
      state.runningMan.lastPersistence = latestPersistence;
      persistRunningManClientState();
      state.strategy = {
        status: "SUCCESS",
        strategies: reconciled,
        selectedSimulationStrategy: paperContext.selectedSimulationStrategy,
        paperTrading: paperContext.paperTrading,
        metadata: cached.metadata,
        error: null
      };
      state.decision = decision;
      if (changed || root.strategyCommandCenter.hidden) {
        renderStrategies(root, reconciled, cached.metadata);
      } else {
        updateStrategyEngineStatus("Cached");
      }
      renderPaperTradingCard({
        strategies: paperContext.renderStrategies,
        paperTrading: paperContext.paperTrading
      });
      renderRunningManStatus(latestPersistence);
    } else {
      const strategyStarted = performance.now();
      state.strategy.status = "LOADING";
      if (state.strategy?.strategies?.length) {
        updateStrategyEngineStatus("Thinking");
      } else {
        renderStrategyStatus(root, "EAGLE VIEW READY. Commander AI is designing three missions...");
      }
      try {
        const ai = await fetchHumanReadableStrategies(analyzePayload, controller.signal);
        latestPersistence = ai.persistence || null;
        handleRunningManPersistence(latestPersistence);
        const reconciled = reconcileStrategiesWithSignal(ai.strategies, marketSignal);
        const paperContext = buildPaperTradingContext(reconciled, ai.paperTrading, ai.metadata, marketSignal);
        const changed = strategiesChanged(state.strategy?.strategies, reconciled);
        const strategyResult = {
          strategies: ai.strategies,
          paperTrading: ai.paperTrading,
          metadata: ai.metadata,
          strategyMs: performance.now() - strategyStarted
        };
        setCache(`strategy:${fingerprint}`, strategyResult);
        state.runningMan.lastPersistence = latestPersistence;
        persistRunningManClientState();
        state.strategyStatus = "SUCCESS";
        state.strategy = {
          status: "SUCCESS",
          strategies: reconciled,
          selectedSimulationStrategy: paperContext.selectedSimulationStrategy,
          paperTrading: paperContext.paperTrading,
          metadata: ai.metadata,
          error: null
        };
        state.decision = decision;
        if (changed || root.strategyCommandCenter.hidden) {
          renderStrategies(root, reconciled, ai.metadata);
        } else {
          updateStrategyEngineStatus("Ready");
        }
        renderPaperTradingCard({
          strategies: paperContext.renderStrategies,
          paperTrading: paperContext.paperTrading
        });
        renderRunningManStatus(latestPersistence);
      } catch (strategyError) {
        if (strategyError.name === "AbortError") throw strategyError;
        state.strategyStatus = "ERROR";
        state.strategy = {
          status: "ERROR",
          strategies: state.strategy?.strategies || [],
          selectedSimulationStrategy: state.strategy?.selectedSimulationStrategy || null,
          paperTrading: state.strategy?.paperTrading || null,
          metadata: state.strategy?.metadata || null,
          error: strategyError
        };
        if (state.strategy?.strategies?.length) {
          updateStrategyEngineStatus("Unavailable");
        } else {
          renderStrategyError(root, strategyError);
        }
      }
    }
    state.status = "SUCCESS";
    appendObservation({
      observedAt: new Date().toISOString(),
      action: state.signal.current?.signal || state.decision.action,
      summary: state.decision.summary,
      signal: state.signal.current,
      runId: latestPersistence?.runId || state.runningMan.runId,
      observationNo: latestPersistence?.observationNo ?? runningManObservation.observationNo,
      persisted: latestPersistence?.status === "SAVED",
      persistedAt: latestPersistence?.persistedAt || null,
      bullStrength: state.signal.current?.bullStrength ?? null,
      bearStrength: state.signal.current?.bearStrength ?? null
    });
    renderPostStage(performance.now() - started);
    saveSession(request);
    scheduleLoop(state, () => observe(state.request, { background: true }));
  } catch (error) {
    if (error.name !== "AbortError") {
      state.status = "ERROR";
      state.live = false;
      state.runningMan.active = false;
      persistRunningManClientState();
      renderError(root, error);
      renderEngineStatus("Market Engine: failed", "Strategy Engine: stopped");
    }
  } finally {
    state.fetchStartedAt = null;
    setLoading(false, null, { quiet: background });
  }
}

async function retryCommander() {
  if (!state.lastEvidence || !state.request || !state.decision) return;
  const controller = new AbortController();
  state.controller = controller;
  state.strategyStatus = "DESIGNING";
  state.strategy = {
    status: "LOADING",
    strategies: state.strategy?.strategies || [],
    selectedSimulationStrategy: state.strategy?.selectedSimulationStrategy || null,
    paperTrading: state.strategy?.paperTrading || null,
    metadata: state.strategy?.metadata || null,
    error: null
  };
  if (state.strategy?.strategies?.length) {
    updateStrategyEngineStatus("Thinking");
  } else {
    renderStrategyStatus(root, "Commander AI is redesigning missions...");
  }
  try {
    const runningManObservation = nextRunningManObservation();
    const analyzePayload = buildAnalyzeMarketPayload({
      request: state.request,
      quote: state.lastEvidence.quote,
      evidence: state.lastEvidence,
      relevantNews: state.lastEvidence.relevantNews,
      runningMan: runningManObservation
    });
    const ai = await fetchHumanReadableStrategies(analyzePayload, controller.signal);
    handleRunningManPersistence(ai.persistence || null);
    const reconciled = reconcileStrategiesWithSignal(ai.strategies, state.signal.current);
    const paperContext = buildPaperTradingContext(reconciled, ai.paperTrading, ai.metadata, state.signal.current);
    const changed = strategiesChanged(state.strategy?.strategies, reconciled);
    state.strategyStatus = "SUCCESS";
    state.strategy = {
      status: "SUCCESS",
      strategies: reconciled,
      selectedSimulationStrategy: paperContext.selectedSimulationStrategy,
      paperTrading: paperContext.paperTrading,
      metadata: ai.metadata,
      error: null
    };
    state.runningMan.lastPersistence = ai.persistence || null;
    persistRunningManClientState();
    setCache(`strategy:${evidenceFingerprint(state.lastEvidence, state.lastEvidence.quote)}`, {
      strategies: ai.strategies,
      paperTrading: ai.paperTrading,
      metadata: ai.metadata
    });
    if (changed || root.strategyCommandCenter.hidden) {
      renderStrategies(root, reconciled, ai.metadata);
    } else {
      updateStrategyEngineStatus("Ready");
    }
    renderPaperTradingCard({
      strategies: paperContext.renderStrategies,
      paperTrading: paperContext.paperTrading
    });
    renderRunningManStatus(ai.persistence || null);
    renderCommander(root, state.decision);
    renderPostStage(null);
  } catch (error) {
    if (error.name !== "AbortError") {
      state.strategyStatus = "ERROR";
      state.strategy = {
        status: "ERROR",
        strategies: state.strategy?.strategies || [],
        selectedSimulationStrategy: state.strategy?.selectedSimulationStrategy || null,
        paperTrading: state.strategy?.paperTrading || null,
        metadata: state.strategy?.metadata || null,
        error
      };
      if (state.strategy?.strategies?.length) {
        updateStrategyEngineStatus("Unavailable");
      } else {
        renderStrategyError(root, error);
      }
    }
  }
}

function renderMarketStage({ request, market, decision, marketMs, totalMs }) {
  const context = { request, arenas: market.arenas, marketStatus: state.marketStatus, strategyStatus: state.strategyStatus };
  renderMarketView(root, context);
  renderCommander(root, decision);
  renderBattle(root, decision);
  renderChart(root, market.candles);
  renderArenas(root, market.arenas);
  renderCapital(root, decision, request.exchange);
  renderTiming(root, request, decision);
  renderTimeline(root, state.observations);
  renderTelemetry(root, { marketMs, totalMs });
  renderReasoning(decision);
  renderNews(market.news);
  renderFailedArenas(market.failedArenas || []);
}

function renderPostStage(totalMs) {
  renderMarketView(root, {
    request: state.request,
    arenas: state.market.arenas,
    marketStatus: state.marketStatus,
    strategyStatus: state.strategyStatus
  });
  renderTimeline(root, state.observations);
  renderTelemetry(root, { totalMs, strategyMs: state.strategy?.metadata?.latencyMs?.openAI });
  renderEngineStatus(`Market Engine: ${state.marketStatus}`, `Strategy Engine: ${state.strategyStatus}`);
}

function updateStrategyEngineStatus(label) {
  const status = document.getElementById("strategy-engine-status");
  if (status) {
    status.textContent = label;
  }
}

function strategiesChanged(previous, next) {
  if (!Array.isArray(previous) || !Array.isArray(next)) return true;
  return JSON.stringify(previous) !== JSON.stringify(next);
}

function prepareRunningManForRequest() {
  if (!state.runningMan.active) {
    startRunningManSession();
    renderRunningManStatus(null);
  }
}

function handleRunningManPersistence(persistence) {
  console.debug("[RunningMan]", {
    runId: persistence?.runId,
    observationNo: persistence?.observationNo,
    status: persistence?.status,
    rowId: persistence?.rowId
  });

  if (persistence?.status === "ERROR") {
    console.warn("Running Man persistence failed:", persistence.error);
  }
}

export function buildAnalyzeMarketPayload({
  request,
  quote,
  evidence,
  relevantNews,
  runningMan
}) {
  return {
    mission: {
      symbol: request.symbol,
      exchange: request.exchange,
      capital: request.capital,
      riskProfile: request.riskProfile,
      maximumHoldingMinutes: request.maximumHoldingMinutes
    },

    quote: {
      price: quote?.price ?? null,
      previousClose: quote?.previousClose ?? null,
      dayHigh: quote?.dayHigh ?? null,
      dayLow: quote?.dayLow ?? null,
      changePercent: quote?.changePercent ?? null
    },

    arenas: buildCompactArenaPayload(evidence),

    relevantNews: Array.isArray(relevantNews) ? relevantNews.slice(0, 5) : [],

    runId: runningMan?.runId || null,

    observationNo: Number.isInteger(runningMan?.observationNo)
      ? runningMan.observationNo
      : 0
  };
}

export function buildCompactArenaPayload(evidence) {
  return Array.isArray(evidence?.arenas) ? evidence.arenas : [];
}

function buildPaperTradingContext(strategies, paperTrading, metadata, marketSignal) {
  const selectedStrategy = selectSimulationStrategy(strategies);
  const reconciledPlan = reconcileSimulationPlanWithSignal(
    selectedStrategy?.simulationPlan,
    marketSignal
  );
  const reconciledStrategy = selectedStrategy
    ? {
        ...selectedStrategy,
        simulationPlan: reconciledPlan
      }
    : null;

  return {
    selectedSimulationStrategy: reconciledStrategy,
    paperTrading: paperTrading || null,
    metadata: metadata || null,
    renderStrategies: reconciledStrategy
      ? [
          reconciledStrategy,
          ...strategies.filter((strategy) => strategy.id !== reconciledStrategy.id)
        ]
      : strategies
  };
}

function buildDecision(marketSignal, campaign, capitalPlan, request) {
  const commander = getCommanderPresentation(marketSignal);
  const confidence = calculateSignalConfidence(marketSignal);
  const explanation = buildLocalSignalExplanation(marketSignal);

  return {
    action: marketSignal.longAction === "BUY" ? "BUY" : marketSignal.longAction === "WAIT" ? "WAIT" : "NO_TRADE",
    commanderSignalAction: commander.action,
    headline: commander.headline,
    longAction: marketSignal.longAction,
    confidence,
    summary: explanation,
    marketSignal,
    speculation: campaign,
    capitalPlan,
    tradeTiming: {
      requestedMaximumMinutes: request.maximumHoldingMinutes,
      recommendedMinimumMinutes: Math.min(10, request.maximumHoldingMinutes),
      recommendedMaximumMinutes: request.maximumHoldingMinutes,
      timingDecision: marketSignal.longAction === "BUY" ? "ENTER_IF_TRIGGERED" : "WAIT",
      entryTrigger: marketSignal.longAction === "BUY" ? "Use only AI strategy triggers compatible with the local signal." : "No long entry until the local signal improves.",
      timeExitRule: `Exit by ${request.maximumHoldingMinutes} minutes or invalidation.`
    },
    dataQuality: "LOCAL_ENGINE"
  };
}

function buildCompactEvidence(request, market, decision) {
  const entryArena = market.arenas.find((arena) => arena.role === "ENTRY") || market.arenas[0];
  const quotePrice = firstFinite(
    market.quote?.price,
    market.quote?.regularMarketPrice,
    market.quote?.currentPrice,
    market.quote?.lastPrice,
    entryArena?.signals?.latestPrice
  );
  return {
    mission: {
      symbol: request.symbol,
      exchange: request.exchange,
      capital: request.capital,
      riskProfile: request.riskProfile,
      maximumHoldingMinutes: request.maximumHoldingMinutes
    },
    quote: {
      price: quotePrice,
      previousClose: firstFinite(market.quote?.previousClose, market.quote?.regularMarketPreviousClose, entryArena?.signals?.previousPrice),
      dayHigh: firstFinite(market.quote?.dayHigh, market.quote?.regularMarketDayHigh),
      dayLow: firstFinite(market.quote?.dayLow, market.quote?.regularMarketDayLow),
      changePercent: firstFinite(market.quote?.changePercent, market.quote?.regularMarketChangePercent)
    },
    arenas: market.arenas.map((arena) => ({
      label: arena.label,
      role: arena.role,
      interval: arena.interval,
      winner: arena.signals.winner,
      latestPrice: arena.signals.latestPrice,
      latestReturnPercent: arena.signals.latestReturnPercent,
      return3CandlesPercent: arena.signals.return3CandlesPercent,
      return5CandlesPercent: arena.signals.return5CandlesPercent,
      return10CandlesPercent: arena.signals.return10CandlesPercent,
      sma5: arena.signals.sma5,
      sma10: arena.signals.sma10,
      sma20: arena.signals.sma20,
      ema9: arena.signals.ema9,
      ema21: arena.signals.ema21,
      rsi14: arena.signals.rsi14,
      volumeRatio20: arena.signals.volumeRatio20,
      recentHigh20: arena.signals.recentHigh20,
      recentLow20: arena.signals.recentLow20,
      latestCandleTime: arena.signals.latestCandleTime,
      candleAgeMinutes: arena.signals.candleAgeMinutes,
      bullEvidence: arena.signals.bullEvidence,
      bearEvidence: arena.signals.bearEvidence,
      momentum: arena.signals.momentum,
    })),
    relevantNews: filterRelevantNews(
      market.news,
      request.symbol,
      market.company?.name || market.company?.longName || market.company?.shortName,
      market.company?.sector,
      market.company?.industry
    ).slice(0, 5).map((item) => ({
      title: item.title,
      publisher: item.publisher || item.source,
      publishedAt: item.publishedAt || item.datetime
    }))
  };
}

function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function filterRelevantNews(news, symbol, companyName, sector, industry) {
  const terms = [symbol, companyName, sector, industry]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return (Array.isArray(news) ? news : []).filter((item) => {
    const haystack = [
      item.title,
      item.publisher,
      item.summary,
      item.description,
      ...(Array.isArray(item.relatedTickers) ? item.relatedTickers : []),
      ...(Array.isArray(item.tickers) ? item.tickers : [])
    ].filter(Boolean).join(" ").toLowerCase();
    return terms.some((term) => haystack.includes(term));
  });
}

function renderReasoning(decision) {
  const signal = decision.marketSignal;
  root.reasoningSection.innerHTML = `
    <p class="section-label">LOCAL ENGINE</p>
    <h2>DETERMINISTIC EVIDENCE</h2>
    <div class="final-verdict"><span>Signal</span><strong>${escapeHtml(signal?.signal || decision.action)}</strong></div>
    <div class="command-lines">
      <span><strong>Summary</strong>${escapeHtml(decision.summary)}</span>
      <span><strong>Bulls</strong>${escapeHtml(signal?.bullStrength ?? "—")}</span>
      <span><strong>Bears</strong>${escapeHtml(signal?.bearStrength ?? "—")}</span>
      <span><strong>Difference</strong>${escapeHtml(signal?.difference ?? "—")}</span>
      <span><strong>Campaign</strong>${escapeHtml(signal?.campaignDominance || decision.speculation.currentDominance)}</span>
      <span><strong>Entry</strong>${escapeHtml(signal?.entryWinner || "UNKNOWN")}</span>
      <span><strong>Confirmation</strong>${escapeHtml(signal?.confirmationWinner || "UNKNOWN")}</span>
      <span><strong>Context</strong>${escapeHtml(signal?.contextWinner || "UNKNOWN")}</span>
      ${signal?.warnings?.length ? `<span><strong>Warnings</strong>${escapeHtml(signal.warnings.join(" "))}</span>` : ""}
    </div>
  `;
}

function renderNews(news) {
  root.newsSection.innerHTML = `<p class="section-label">NEWS</p><h2>RELEVANT NEWS</h2>${(news || []).length ? `<div class="news-list">${news.map((item) => `<article class="news-card"><h3>${escapeHtml(item.title || "Untitled")}</h3><p class="muted">${escapeHtml(item.publisher || item.source || "—")}</p></article>`).join("")}</div>` : `<p class="muted">No news returned.</p>`}`;
}

function renderFailedArenas(failedArenas) {
  if (!Array.isArray(failedArenas) || failedArenas.length === 0) {
    root.failedArenas.hidden = true;
    root.failedArenas.innerHTML = "";
    return;
  }

  root.failedArenas.hidden = false;
  root.failedArenas.innerHTML = `
    <p class="section-label">PARTIAL FEED</p>
    <h2>Some battlefields could not be observed.</h2>
    <details>
      <summary>View failed arenas</summary>
      <div class="command-lines">
        ${failedArenas.map((item) => `
          <span>
            <strong>${escapeHtml(item.arena?.label || item.arena?.interval || "Arena")}</strong>
            ${escapeHtml(item.message || "Market arena unavailable")}
          </span>
        `).join("")}
      </div>
    </details>
  `;
}

function renderEngineStatus(marketText, strategyText) {
  root.sessionStatus.innerHTML = `
    <p class="section-label">ENGINE STATUS</p>
    <h2>TWO-STAGE PIPELINE</h2>
    <div class="mission-grid">
      <div class="mission-metric"><span>Market Engine</span><strong>${escapeHtml(marketText)}</strong></div>
      <div class="mission-metric"><span>Strategy Engine</span><strong>${escapeHtml(strategyText)}</strong></div>
      <div class="mission-metric"><span>Fetch Time</span><strong>${fetchElapsed()}</strong></div>
    </div>
  `;
  const liveText = state.live ? `Running · ${state.status === "LOADING" ? `fetching now ${fetchElapsed()}` : "continuous"}` : "Feed ready";
  root.feedStatusText.textContent = liveText;
}

function setLoading(isLoading, text = "Working", options = {}) {
  const quiet = options.quiet === true;
  root.runButton.disabled = isLoading && !quiet;
  root.cancelButton.hidden = !isLoading && !state.live;
  root.cancelButton.textContent = state.live ? "Stop" : "Cancel";
  root.loadingPanel.hidden = !isLoading || quiet;
  if (text) root.loadingText.textContent = text;
  document.getElementById("main").setAttribute("aria-busy", String(isLoading && !quiet));
  if (isLoading) startFetchClock();
  else stopFetchClock();
}

function startFetchClock() {
  if (fetchClockTimer) return;
  fetchClockTimer = window.setInterval(() => renderEngineStatus(`Market Engine: ${state.marketStatus}`, `Strategy Engine: ${state.strategyStatus}`), 250);
}

function stopFetchClock() {
  if (fetchClockTimer) window.clearInterval(fetchClockTimer);
  fetchClockTimer = null;
}

function stopObservation() {
  stopLoop(state);
  state.status = state.marketStatus === "SUCCESS" ? "SUCCESS" : "IDLE";
  state.runningMan.active = false;
  persistRunningManClientState();
  setLoading(false);
  renderEngineStatus(`Market Engine: ${state.marketStatus}`, `Strategy Engine: ${state.strategyStatus}`);
  renderRunningManStatus(state.runningMan.lastPersistence);
}

function buildRequest() {
  state.pollIntervalMs = Number(root.pollInterval.value);
  return {
    symbol: root.symbol.value.trim().toUpperCase(),
    exchange: root.exchange.value,
    capital: Number(root.capital.value),
    riskProfile: root.riskProfile.value,
    maximumHoldingMinutes: HOLDING_OPTIONS[root.holdingPeriod.value],
    newsCount: 5,
    persist: true
  };
}

function validateRequest(request) {
  const errors = {};
  if (!request.symbol) errors.symbol = "Symbol is required.";
  if (request.symbol.length > 30) errors.symbol = "Symbol must be 30 characters or fewer.";
  if (!SUPPORTED_EXCHANGES.includes(request.exchange)) errors.exchange = "Unsupported exchange.";
  if (!Number.isFinite(request.capital) || request.capital < 1000 || request.capital > 1000000) errors.capital = "Capital must be 1000 to 1000000.";
  if (!SUPPORTED_RISKS.includes(request.riskProfile)) errors.riskProfile = "Unsupported risk profile.";
  if (!Number.isFinite(request.maximumHoldingMinutes) || request.maximumHoldingMinutes <= 0) errors.holdingPeriod = "Invalid holding period.";
  if (!POLL_INTERVALS.includes(state.pollIntervalMs)) errors.pollInterval = "Invalid loop delay.";
  ["symbol", "exchange", "capital", "riskProfile", "holdingPeriod", "pollInterval"].forEach((name) => {
    const element = document.getElementById(`${name}Error`);
    if (element) element.textContent = errors[name] || "";
  });
  const first = Object.keys(errors)[0];
  if (first) {
    root[first]?.focus();
    return false;
  }
  return true;
}

function saveSession(request) {
  try {
    sessionStorage.setItem(STORAGE_REQUEST, JSON.stringify({ ...request, pollIntervalMs: state.pollIntervalMs }));
    sessionStorage.setItem(STORAGE_RESPONSE, JSON.stringify({ request, market: state.market, decision: state.decision }));
    if (state.strategy?.strategies?.length) {
      sessionStorage.setItem(STORAGE_STRATEGIES, JSON.stringify({
        strategies: state.strategy.strategies,
        selectedSimulationStrategy: state.strategy.selectedSimulationStrategy,
        paperTrading: state.strategy.paperTrading,
        metadata: state.strategy.metadata,
        savedAt: new Date().toISOString()
      }));
    }
  } catch {
    // ignored
  }
}

function restoreSession() {
  try {
    const savedRequest = JSON.parse(sessionStorage.getItem(STORAGE_REQUEST) || "null");
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_RESPONSE) || "null");
    const savedStrategies = JSON.parse(sessionStorage.getItem(STORAGE_STRATEGIES) || "null");
    if (savedRequest) {
      root.symbol.value = savedRequest.symbol || "RELIANCE";
      root.exchange.value = savedRequest.exchange || "NSE";
      root.capital.value = savedRequest.capital || 10000;
      root.riskProfile.value = savedRequest.riskProfile || "CONTROLLED";
      root.pollInterval.value = String(savedRequest.pollIntervalMs ?? 0);
      updateCurrency();
    }
    if (saved?.market && saved?.decision) {
      state.request = saved.request;
      state.market = saved.market;
      state.decision = saved.decision;
      state.signal.current = saved.decision?.marketSignal || null;
      state.signal.previous = null;
      state.signal.changedAt = state.signal.current ? new Date().toISOString() : null;
      state.strategy = {
        status: savedStrategies?.strategies?.length ? "SUCCESS" : "IDLE",
        strategies: savedStrategies?.strategies || [],
        selectedSimulationStrategy: savedStrategies?.selectedSimulationStrategy || null,
        paperTrading: savedStrategies?.paperTrading || null,
        metadata: savedStrategies?.metadata || null,
        error: null
      };
      state.marketStatus = "RESTORED";
      state.strategyStatus = savedStrategies?.strategies?.length ? "RESTORED" : "IDLE";
      renderMarketStage({ request: saved.request, market: saved.market, decision: saved.decision, marketMs: null, totalMs: null });
      if (savedStrategies?.strategies?.length) {
        const paperContext = buildPaperTradingContext(
          savedStrategies.strategies,
          savedStrategies.paperTrading,
          savedStrategies.metadata,
          state.signal.current
        );
        state.strategy.selectedSimulationStrategy = paperContext.selectedSimulationStrategy;
        state.strategy.paperTrading = paperContext.paperTrading;
        renderStrategies(root, savedStrategies.strategies, savedStrategies.metadata);
        renderPaperTradingCard({
          strategies: paperContext.renderStrategies,
          paperTrading: paperContext.paperTrading
        });
      }
      renderPostStage(null);
    }
  } catch {
    sessionStorage.removeItem(STORAGE_REQUEST);
    sessionStorage.removeItem(STORAGE_RESPONSE);
    sessionStorage.removeItem(STORAGE_STRATEGIES);
  }
}

function updateCurrency() {
  root.currencySymbol.textContent = ["NSE", "BSE"].includes(root.exchange.value) ? "₹" : "$";
}

function fetchElapsed() {
  if (!state.fetchStartedAt) return "0.0s";
  return `${((Date.now() - state.fetchStartedAt.getTime()) / 1000).toFixed(1)}s`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
