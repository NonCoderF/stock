export const state = {
  status: "IDLE",
  marketStatus: "IDLE",
  strategyStatus: "IDLE",
  request: null,
  market: null,
  decision: null,
  strategy: {
    status: "IDLE",
    strategies: [],
    selectedSimulationStrategy: null,
    paperTrading: null,
    metadata: null,
    error: null
  },
  signal: {
    previous: null,
    current: null,
    changedAt: null
  },
  runningMan: {
    runId: null,
    observationNo: 0,
    active: false,
    lastPersistence: null,
    startedAt: null
  },
  lastEvidence: null,
  response: null,
  error: null,
  controller: null,
  pollTimer: null,
  live: false,
  pollIntervalMs: 0,
  sessionStartedAt: null,
  lastUpdatedAt: null,
  fetchStartedAt: null,
  observations: []
};

export function resetForRequest(request, controller) {
  state.status = "LOADING";
  state.marketStatus = "LOADING";
  state.strategyStatus = "IDLE";
  state.request = request;
  state.controller = controller;
  state.error = null;
  state.fetchStartedAt = new Date();
  if (!state.sessionStartedAt) state.sessionStartedAt = state.fetchStartedAt;
}

export function appendObservation(summary) {
  state.observations.push({
    time: new Date().toISOString(),
    observedAt: summary.observedAt || new Date().toISOString(),
    action: summary.action,
    summary: summary.summary || "Observation completed.",
    signal: summary.signal || null,
    runId: summary.runId || null,
    observationNo: summary.observationNo ?? null,
    persisted: summary.persisted === true,
    persistedAt: summary.persistedAt || null,
    bullStrength: summary.bullStrength ?? summary.signal?.bullStrength ?? null,
    bearStrength: summary.bearStrength ?? summary.signal?.bearStrength ?? null
  });
  if (state.observations.length > 30) state.observations = state.observations.slice(-30);
}
