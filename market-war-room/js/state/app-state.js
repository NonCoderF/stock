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
    metadata: null,
    error: null
  },
  signal: {
    previous: null,
    current: null,
    changedAt: null
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
    action: summary.action,
    summary: summary.summary || "Observation completed.",
    signal: summary.signal || null
  });
  if (state.observations.length > 30) state.observations = state.observations.slice(-30);
}
