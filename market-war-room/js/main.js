import { fetchAllArenas, fetchMarketArena } from "./api/market-api.js";
import { analyzeMarket } from "./analysis/market-analyzer.js";
import { applyRelatedConfirmation, buildRelatedConfirmation } from "./analysis/related-confirmation.js";
import { rankStockCandidates } from "./analysis/stock-search.js";
import { buildArenaEvidence } from "./engine/arena-evidence.js";
import { chooseArenas } from "./engine/arena-selector.js";
import { buildCampaign } from "./engine/campaign.js";
import {
  buildLocalSignalExplanation,
  calculateSignalConfidence,
  determineMarketSignal,
  getCommanderPresentation,
  hasSignalChanged
} from "./engine/market-signal.js";
import { buildCapitalPlan } from "./engine/risk-policy.js";
import { state, appendObservation, resetForRequest } from "./state/app-state.js";
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
import { renderMarketDirectionCard } from "./ui/market-direction-card.js";
import { renderCapital, renderMarketView, renderTelemetry, renderTiming } from "./ui/market-view.js";
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

let fetchClockTimer = null;
const root = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  restoreRunningManClientState();
  renderRunningManStatus(state.runningMan.lastPersistence);
  const restored = restoreSession();
  updateCurrency();
  if (!restored) {
    runInitialStockSearch();
  }
});

function cacheElements() {
  [
    "analysisForm", "symbol", "exchange", "capital", "riskProfile", "relatedSymbols", "holdingPeriod", "pollInterval",
    "currencySymbol", "runButton", "cancelButton", "loadingPanel", "loadingText", "errorPanel",
    "emptyState", "resultShell", "marketFacts", "commanderHero", "commanderCard", "battleCard",
    "arenasSection", "capitalPlan", "timingPlan", "chartSection", "marketDirectionCard", "reasoningSection", "sessionStatus",
    "timelineSection", "newsSection", "failedArenas", "telemetry", "feedStatusText",
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
  document.addEventListener("click", (event) => {
    const stockCard = event.target?.closest?.(".stock-search-item[data-symbol]");
    if (stockCard) {
      selectStockCandidate(stockCard.dataset.symbol, stockCard.dataset.symbols);
    }
  });
  document.addEventListener("keydown", (event) => {
    const stockCard = event.target?.closest?.(".stock-search-item[data-symbol]");
    if (stockCard && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      selectStockCandidate(stockCard.dataset.symbol, stockCard.dataset.symbols);
    }
  });
  root.symbol.addEventListener("input", () => {
    const start = root.symbol.selectionStart;
    root.symbol.value = root.symbol.value.toUpperCase();
    root.symbol.setSelectionRange(start, start);
  });
  root.relatedSymbols.addEventListener("input", () => {
    const start = root.relatedSymbols.selectionStart;
    root.relatedSymbols.value = root.relatedSymbols.value.toUpperCase();
    root.relatedSymbols.setSelectionRange(start, start);
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
    renderEngineStatus("Market Engine: fetching arenas in parallel");
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
    state.market = market;
    state.decision = decision;
    state.directionAnalysis = analyzeMarket(market.candles, {
      includeCurrentCandle: true
    });
    applyRelatedConfirmation(state.directionAnalysis, await analyzeRelatedStocks({
      request,
      entryArena,
      primaryAnalysis: state.directionAnalysis,
      primaryCandles: market.candles,
      signal: controller.signal
    }));
    state.lastUpdatedAt = new Date();
    renderMarketStage({ request, market, decision, marketMs: performance.now() - marketStarted, totalMs: performance.now() - started });
    const evidence = buildCompactEvidence(request, market, decision);
    market.quote = {
      ...market.quote,
      ...evidence.quote
    };
    state.lastEvidence = evidence;
    const runningManObservation = nextRunningManObservation();
    const latestPersistence = {
      runId: runningManObservation.runId,
      observationNo: runningManObservation.observationNo,
      status: "LOCAL_ONLY",
      persistedAt: null
    };
    state.runningMan.lastPersistence = latestPersistence;
    persistRunningManClientState();
    renderRunningManStatus(latestPersistence);
    state.status = "SUCCESS";
    appendObservation({
      observedAt: new Date().toISOString(),
      action: state.signal.current?.signal || state.decision.action,
      summary: state.decision.summary,
      signal: state.signal.current,
      runId: latestPersistence?.runId || state.runningMan.runId,
      observationNo: latestPersistence?.observationNo ?? runningManObservation.observationNo,
      persisted: false,
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
      renderEngineStatus("Market Engine: failed");
    }
  } finally {
    state.fetchStartedAt = null;
    setLoading(false, null, { quiet: background });
  }
}

function renderMarketStage({ request, market, decision, marketMs, totalMs }) {
  const context = { request, arenas: market.arenas, marketStatus: state.marketStatus };
  renderMarketView(root, context);
  renderCommander(root, decision);
  renderBattle(root, decision);
  renderChart(root, market.candles);
  renderMarketDirectionCard(root, state.directionAnalysis || analyzeMarket(market.candles));
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
    marketStatus: state.marketStatus
  });
  renderTimeline(root, state.observations);
  renderTelemetry(root, { totalMs });
  renderEngineStatus(`Market Engine: ${state.marketStatus}`);
}

function prepareRunningManForRequest() {
  if (!state.runningMan.active) {
    startRunningManSession();
    renderRunningManStatus(null);
  }
}

async function analyzeRelatedStocks({ request, entryArena, primaryAnalysis, primaryCandles, signal }) {
  const relatedSymbols = request.relatedSymbols || [];
  const settled = await Promise.allSettled(
    relatedSymbols.map(async (symbol) => {
      const result = await fetchMarketArena(
        {
          ...request,
          symbol,
          newsCount: 0
        },
        {
          ...entryArena,
          role: "ENTRY",
          label: `${symbol} Related Check`
        },
        signal
      );

      return {
        symbol,
        role: "RELATED",
        candles: result.candles,
        analysis: analyzeMarket(result.candles, {
          includeCurrentCandle: true
        })
      };
    })
  );

  const relatedAnalyses = settled.map((result, index) => {
    const symbol = relatedSymbols[index];
    if (result.status === "fulfilled") return result.value;
    if (result.reason?.name === "AbortError") throw result.reason;
    return {
      symbol,
      analysis: {
        status: "FAILED"
      },
      message: result.reason?.message || "Related symbol unavailable"
    };
  });

  const confirmation = buildRelatedConfirmation(primaryAnalysis, relatedAnalyses);
  confirmation.searchRanking = rankStockCandidates([
    {
      symbol: request.symbol,
      role: "MAIN",
      candles: primaryCandles,
      analysis: primaryAnalysis
    },
    ...relatedAnalyses
  ]);
  return confirmation;
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
      entryTrigger: marketSignal.longAction === "BUY" ? "Use only local signal triggers compatible with the current battlefield." : "No long entry until the local signal improves.",
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

function renderEngineStatus(marketText) {
  root.sessionStatus.innerHTML = `
    <p class="section-label">ENGINE STATUS</p>
    <h2>MARKET PIPELINE</h2>
    <div class="mission-grid">
      <div class="mission-metric"><span>Market Engine</span><strong>${escapeHtml(marketText)}</strong></div>
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
  fetchClockTimer = window.setInterval(() => renderEngineStatus(`Market Engine: ${state.marketStatus}`), 250);
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
  renderEngineStatus(`Market Engine: ${state.marketStatus}`);
  renderRunningManStatus(state.runningMan.lastPersistence);
}

function selectStockCandidate(symbol, candidateSymbolsText) {
  const selected = String(symbol || "").trim().toUpperCase();
  if (!selected) return;

  const currentMain = root.symbol.value.trim().toUpperCase();
  const rankedSymbols = String(candidateSymbolsText || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  const existingRelated = parseRelatedSymbols(root.relatedSymbols.value, selected);
  const related = [...new Set([
    ...rankedSymbols,
    currentMain,
    ...existingRelated
  ].filter((item) => item && item !== selected))].slice(0, 6);

  root.symbol.value = selected;
  root.relatedSymbols.value = related.join(",");
  root.analysisForm.requestSubmit();
}

function runInitialStockSearch() {
  const request = buildRequest();
  if (!validateRequest(request)) return;
  state.live = false;
  observe(request, { background: false });
}

function buildRequest() {
  state.pollIntervalMs = Number(root.pollInterval.value);
  return {
    symbol: root.symbol.value.trim().toUpperCase(),
    exchange: root.exchange.value,
    capital: Number(root.capital.value),
    riskProfile: root.riskProfile.value,
    relatedSymbols: parseRelatedSymbols(root.relatedSymbols.value, root.symbol.value),
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
  if (!Array.isArray(request.relatedSymbols) || request.relatedSymbols.length < 3) errors.relatedSymbols = "Enter at least 3 related symbols.";
  if (!Number.isFinite(request.maximumHoldingMinutes) || request.maximumHoldingMinutes <= 0) errors.holdingPeriod = "Invalid holding period.";
  if (!POLL_INTERVALS.includes(state.pollIntervalMs)) errors.pollInterval = "Invalid loop delay.";
  ["symbol", "exchange", "capital", "riskProfile", "relatedSymbols", "holdingPeriod", "pollInterval"].forEach((name) => {
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
  } catch {
    // ignored
  }
}

function restoreSession() {
  try {
    const savedRequest = JSON.parse(sessionStorage.getItem(STORAGE_REQUEST) || "null");
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_RESPONSE) || "null");
    if (savedRequest) {
      root.symbol.value = savedRequest.symbol || "RELIANCE";
      root.exchange.value = savedRequest.exchange || "NSE";
      root.capital.value = savedRequest.capital || 10000;
      root.riskProfile.value = savedRequest.riskProfile || "CONTROLLED";
      root.relatedSymbols.value = Array.isArray(savedRequest.relatedSymbols)
        ? savedRequest.relatedSymbols.join(",")
        : "ONGC,BPCL,IOC";
      root.pollInterval.value = String(savedRequest.pollIntervalMs ?? 0);
      updateCurrency();
    }
    if (saved?.market && saved?.decision) {
      state.request = saved.request;
      state.market = saved.market;
      state.decision = saved.decision;
      state.directionAnalysis = analyzeMarket(saved.market.candles);
      state.signal.current = saved.decision?.marketSignal || null;
      state.signal.previous = null;
      state.signal.changedAt = state.signal.current ? new Date().toISOString() : null;
      state.marketStatus = "RESTORED";
      renderMarketStage({ request: saved.request, market: saved.market, decision: saved.decision, marketMs: null, totalMs: null });
      renderPostStage(null);
      return true;
    }
  } catch {
    sessionStorage.removeItem(STORAGE_REQUEST);
    sessionStorage.removeItem(STORAGE_RESPONSE);
  }
  return false;
}

function updateCurrency() {
  root.currencySymbol.textContent = ["NSE", "BSE"].includes(root.exchange.value) ? "₹" : "$";
}

function parseRelatedSymbols(value, mainSymbol) {
  const main = String(mainSymbol || "").trim().toUpperCase();
  return [...new Set(
    String(value || "")
      .split(/[\s,]+/)
      .map((symbol) => symbol.trim().toUpperCase())
      .filter((symbol) => symbol && symbol !== main && /^[A-Z0-9.\-_^=]+$/.test(symbol))
  )].slice(0, 6);
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
