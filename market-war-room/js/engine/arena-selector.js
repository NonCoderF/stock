export const ARENA_WEIGHTS = {
  ENTRY: 0.25,
  CONFIRMATION: 0.35,
  CONTEXT: 0.40
};

export function chooseArenas(maximumHoldingMinutes) {
  const minutes = Number(maximumHoldingMinutes);
  if (minutes <= 5) {
    return [
      { label: "1 Minute Arena", role: "ENTRY", interval: "1m", range: "5d", weight: ARENA_WEIGHTS.ENTRY },
      { label: "5 Minute Arena", role: "CONFIRMATION", interval: "5m", range: "5d", weight: ARENA_WEIGHTS.CONFIRMATION },
      { label: "15 Minute Arena", role: "CONTEXT", interval: "15m", range: "1mo", weight: ARENA_WEIGHTS.CONTEXT }
    ];
  }
  if (minutes <= 30) {
    return [
      { label: "5 Minute Arena", role: "ENTRY", interval: "5m", range: "5d", weight: ARENA_WEIGHTS.ENTRY },
      { label: "15 Minute Arena", role: "CONFIRMATION", interval: "15m", range: "1mo", weight: ARENA_WEIGHTS.CONFIRMATION },
      { label: "1 Hour Arena", role: "CONTEXT", interval: "1h", range: "3mo", weight: ARENA_WEIGHTS.CONTEXT }
    ];
  }
  if (minutes <= 240) {
    return [
      { label: "15 Minute Arena", role: "ENTRY", interval: "15m", range: "1mo", weight: ARENA_WEIGHTS.ENTRY },
      { label: "1 Hour Arena", role: "CONFIRMATION", interval: "1h", range: "3mo", weight: ARENA_WEIGHTS.CONFIRMATION },
      { label: "1 Day Arena", role: "CONTEXT", interval: "1d", range: "1y", weight: ARENA_WEIGHTS.CONTEXT }
    ];
  }
  return [
    { label: "1 Hour Arena", role: "ENTRY", interval: "1h", range: "3mo", weight: ARENA_WEIGHTS.ENTRY },
    { label: "1 Day Arena", role: "CONFIRMATION", interval: "1d", range: "1y", weight: ARENA_WEIGHTS.CONFIRMATION },
    { label: "1 Week Arena", role: "CONTEXT", interval: "1wk", range: "5y", weight: ARENA_WEIGHTS.CONTEXT }
  ];
}

export const selectArenas = (request) => chooseArenas(request.maximumHoldingMinutes);
