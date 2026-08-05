const memory = new Map();

export function getCache(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function setCache(key, value) {
  memory.set(key, value);
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // SessionStorage can be unavailable in private contexts.
  }
}

export function evidenceFingerprint(evidence, quote = evidence.quote) {
  return JSON.stringify({
    price: Number(quote?.price || 0).toFixed(2),
    arenas: (evidence.arenas || []).map((arena) => ({
      role: arena.role,
      winner: arena.winner,
      bull: Math.round(arena.bullEvidence ?? arena.bullStrength ?? 0),
      bear: Math.round(arena.bearEvidence ?? arena.bearStrength ?? 0),
      candle: arena.latestCandleTime || null
    }))
  });
}
