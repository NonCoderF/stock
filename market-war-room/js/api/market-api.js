import { normalizeCandles } from "../engine/candle-utils.js";
import { getCache, setCache } from "../state/cache.js";

export async function fetchMarketArena(baseRequest, arena, signal) {
  const url = new URL(window.APP_CONFIG.MARKET_URL);
  url.searchParams.set("symbol", baseRequest.symbol);
  url.searchParams.set("exchange", baseRequest.exchange);
  url.searchParams.set("interval", arena.interval);
  url.searchParams.set("range", arena.range);
  url.searchParams.set("role", arena.role);
  url.searchParams.set("label", arena.label);
  url.searchParams.set("newsCount", String(baseRequest.newsCount || 5));
  const cacheKey = `market:${url.searchParams.toString()}`;

  try {
    const response = await fetch(url.toString(), { method: "GET", signal });
    const payload = await parseJson(response, "Market feed returned invalid JSON.");
    if (!response.ok || payload.success === false) {
      throw new Error(payload?.error?.message || `Market arena failed: ${arena.label}`);
    }
    const normalized = normalizeMarketPayload(payload, arena, false);
    setCache(cacheKey, normalized);
    return normalized;
  } catch (error) {
    if (error.name === "AbortError") throw error;
    const cached = getCache(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
    throw error;
  }
}

export async function fetchAllArenas(baseRequest, arenaDefinitions, signal) {
  const settled = await Promise.allSettled(
    arenaDefinitions.map((arena) => fetchMarketArena(baseRequest, arena, signal))
  );

  const successful = [];
  const failed = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successful.push(result.value);
      return;
    }

    if (result.reason?.name === "AbortError") {
      throw result.reason;
    }

    failed.push({
      arena: arenaDefinitions[index],
      message: result.reason?.message || "Unknown market error"
    });
  });

  if (!successful.length) {
    throw new Error("No market arenas could be loaded.");
  }

  return { successful, failed };
}

function normalizeMarketPayload(payload, arena, cached) {
  const data = payload.data || payload;
  return {
    arena,
    candles: normalizeCandles(data.candles || data.market?.candles || data.chart?.candles),
    quote: data.quote || data.market?.quote || {},
    company: data.company || data.market?.company || {},
    news: data.news || data.market?.news || [],
    raw: payload,
    cached
  };
}

async function parseJson(response, message) {
  try {
    return await response.json();
  } catch {
    throw new Error(message);
  }
}
