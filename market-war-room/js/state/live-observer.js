export function scheduleLoop(state, callback) {
  if (!state.live || !state.request) return;
  if (state.pollTimer) window.clearTimeout(state.pollTimer);
  const delay = Math.max(0, Number(state.pollIntervalMs) || 0);
  state.pollTimer = window.setTimeout(() => {
    if (state.live && state.request && state.status !== "LOADING") callback();
  }, delay);
}

export function stopLoop(state) {
  state.live = false;
  if (state.pollTimer) window.clearTimeout(state.pollTimer);
  state.pollTimer = null;
  if (state.controller) state.controller.abort();
}
