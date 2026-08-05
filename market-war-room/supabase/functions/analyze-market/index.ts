/**
 * Supabase Edge Function: analyze-market
 *
 * Frontend contract:
 * - Accept compact market evidence calculated in the browser.
 * - Ask OpenAI for exactly three LONG-only strategy candidates.
 * - Return proposals only at data.strategyCandidates.
 *
 * This function intentionally does not fetch market data, calculate
 * indicators, validate risk, rank strategies, or persist observations.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL =
  Deno.env.get("OPENAI_STRATEGY_MODEL") ??
  Deno.env.get("OPENAI_MODEL") ??
  "gpt-5-mini";

const OPENAI_TIMEOUT_MS = Number(Deno.env.get("OPENAI_TIMEOUT_MS") ?? "18000");
const MAX_REQUEST_BYTES = 80_000;
const MAX_ATTEMPTS = 3;

const RETRYABLE_STATUSES = new Set([
  408,
  409,
  429,
  500,
  502,
  503,
  504,
  520,
  522,
  524,
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type RiskProfile = "CONSERVATIVE" | "CONTROLLED" | "AGGRESSIVE";
type ArenaRole = "ENTRY" | "CONFIRMATION" | "CONTEXT";
type ArenaWinner = "BULLS" | "BEARS" | "BALANCED" | "UNKNOWN";

interface MissionInput {
  symbol: string;
  exchange: string;
  capital: number;
  riskProfile: RiskProfile;
  maximumHoldingMinutes: number;
}

interface CompactQuote {
  price: number;
  previousClose?: number | null;
  dayHigh?: number | null;
  dayLow?: number | null;
  changePercent?: number | null;
}

interface CompactArena {
  label?: string;
  role: ArenaRole;
  interval: string;
  winner: ArenaWinner;
  latestPrice: number | null;
  latestReturnPercent?: number | null;
  return3CandlesPercent?: number | null;
  return5CandlesPercent?: number | null;
  return10CandlesPercent?: number | null;
  sma5?: number | null;
  sma10?: number | null;
  sma20?: number | null;
  ema9?: number | null;
  ema21?: number | null;
  rsi14?: number | null;
  volumeRatio20?: number | null;
  recentHigh20?: number | null;
  recentLow20?: number | null;
  candleAgeMinutes?: number | null;
  bullEvidence: number;
  bearEvidence: number;
  momentum?: string;
}

interface RelevantNewsItem {
  title: string;
  publisher?: string | null;
  publishedAt?: string | null;
}

interface AnalyzeMarketRequest {
  mission: MissionInput;
  quote: CompactQuote;
  arenas: CompactArena[];
  relevantNews: RelevantNewsItem[];
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requiredString(value: unknown, field: string, maxLength = 100): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, "INVALID_REQUEST", `${field} is required.`);
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    throw new ApiError(
      400,
      "INVALID_REQUEST",
      `${field} exceeds ${maxLength} characters.`,
    );
  }

  return normalized;
}

function normalizeRequest(value: unknown): AnalyzeMarketRequest {
  if (typeof value !== "object" || value === null) {
    throw new ApiError(
      400,
      "INVALID_REQUEST",
      "Request body must be a JSON object.",
    );
  }

  const body = value as Record<string, unknown>;
  const missionRaw = body.mission as Record<string, unknown>;
  const quoteRaw = body.quote as Record<string, unknown>;

  if (typeof missionRaw !== "object" || missionRaw === null) {
    throw new ApiError(400, "INVALID_MISSION", "mission is required.");
  }

  if (typeof quoteRaw !== "object" || quoteRaw === null) {
    throw new ApiError(400, "INVALID_QUOTE", "quote is required.");
  }

  const symbol = requiredString(missionRaw.symbol, "mission.symbol", 30)
    .toUpperCase();
  const exchange = requiredString(missionRaw.exchange, "mission.exchange", 20)
    .toUpperCase();
  const capital = finiteNumber(missionRaw.capital);
  const riskProfile = requiredString(
    missionRaw.riskProfile,
    "mission.riskProfile",
    20,
  ).toUpperCase() as RiskProfile;
  const maximumHoldingMinutes = finiteNumber(
    missionRaw.maximumHoldingMinutes,
  );

  if (capital === null || capital < 1_000 || capital > 10_000_000) {
    throw new ApiError(
      400,
      "INVALID_CAPITAL",
      "mission.capital must be between 1,000 and 10,000,000.",
    );
  }

  if (!["CONSERVATIVE", "CONTROLLED", "AGGRESSIVE"].includes(riskProfile)) {
    throw new ApiError(
      400,
      "INVALID_RISK_PROFILE",
      "mission.riskProfile is unsupported.",
    );
  }

  if (
    maximumHoldingMinutes === null ||
    !Number.isInteger(maximumHoldingMinutes) ||
    maximumHoldingMinutes < 1 ||
    maximumHoldingMinutes > 43_200
  ) {
    throw new ApiError(
      400,
      "INVALID_HOLDING_DURATION",
      "mission.maximumHoldingMinutes must be a positive integer no greater than 43,200.",
    );
  }

  const price = finiteNumber(quoteRaw.price);

  if (price === null || price <= 0) {
    throw new ApiError(
      400,
      "INVALID_QUOTE",
      "quote.price must be a positive number.",
    );
  }

  if (!Array.isArray(body.arenas)) {
    throw new ApiError(400, "INVALID_ARENAS", "arenas must be an array.");
  }

  if (body.arenas.length < 1 || body.arenas.length > 6) {
    throw new ApiError(
      400,
      "INVALID_ARENAS",
      "arenas must contain between 1 and 6 items.",
    );
  }

  const arenas: CompactArena[] = body.arenas.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new ApiError(
        400,
        "INVALID_ARENA",
        `arenas[${index}] must be an object.`,
      );
    }

    const arena = item as Record<string, unknown>;
    const role = requiredString(
      arena.role,
      `arenas[${index}].role`,
      20,
    ).toUpperCase() as ArenaRole;
    const winner = requiredString(
      arena.winner,
      `arenas[${index}].winner`,
      20,
    ).toUpperCase() as ArenaWinner;
    const bullEvidence = finiteNumber(arena.bullEvidence);
    const bearEvidence = finiteNumber(arena.bearEvidence);

    if (!["ENTRY", "CONFIRMATION", "CONTEXT"].includes(role)) {
      throw new ApiError(
        400,
        "INVALID_ARENA_ROLE",
        `arenas[${index}].role is unsupported.`,
      );
    }

    if (!["BULLS", "BEARS", "BALANCED", "UNKNOWN"].includes(winner)) {
      throw new ApiError(
        400,
        "INVALID_ARENA_WINNER",
        `arenas[${index}].winner is unsupported.`,
      );
    }

    if (
      bullEvidence === null ||
      bearEvidence === null ||
      bullEvidence < 0 ||
      bullEvidence > 100 ||
      bearEvidence < 0 ||
      bearEvidence > 100
    ) {
      throw new ApiError(
        400,
        "INVALID_ARENA_EVIDENCE",
        `arenas[${index}] bullEvidence and bearEvidence must be between 0 and 100.`,
      );
    }

    return {
      label: typeof arena.label === "string" ? arena.label.slice(0, 80) : "",
      role,
      interval: requiredString(arena.interval, `arenas[${index}].interval`, 20),
      winner,
      latestPrice: finiteNumber(arena.latestPrice),
      latestReturnPercent: finiteNumber(arena.latestReturnPercent),
      return3CandlesPercent: finiteNumber(arena.return3CandlesPercent),
      return5CandlesPercent: finiteNumber(arena.return5CandlesPercent),
      return10CandlesPercent: finiteNumber(arena.return10CandlesPercent),
      sma5: finiteNumber(arena.sma5),
      sma10: finiteNumber(arena.sma10),
      sma20: finiteNumber(arena.sma20),
      ema9: finiteNumber(arena.ema9),
      ema21: finiteNumber(arena.ema21),
      rsi14: finiteNumber(arena.rsi14),
      volumeRatio20: finiteNumber(arena.volumeRatio20),
      recentHigh20: finiteNumber(arena.recentHigh20),
      recentLow20: finiteNumber(arena.recentLow20),
      candleAgeMinutes: finiteNumber(arena.candleAgeMinutes),
      bullEvidence,
      bearEvidence,
      momentum:
        typeof arena.momentum === "string" ? arena.momentum.slice(0, 40) : "",
    };
  });

  const relevantNews = Array.isArray(body.relevantNews)
    ? body.relevantNews
      .slice(0, 5)
      .filter((item) => {
        return (
          typeof item === "object" &&
          item !== null &&
          typeof (item as Record<string, unknown>).title === "string"
        );
      })
      .map((item) => {
        const news = item as Record<string, unknown>;

        return {
          title: String(news.title).trim().slice(0, 240),
          publisher:
            typeof news.publisher === "string"
              ? news.publisher.trim().slice(0, 100)
              : null,
          publishedAt:
            typeof news.publishedAt === "string"
              ? news.publishedAt.trim().slice(0, 80)
              : null,
        };
      })
    : [];

  return {
    mission: {
      symbol,
      exchange,
      capital,
      riskProfile,
      maximumHoldingMinutes,
    },
    quote: {
      price,
      previousClose: finiteNumber(quoteRaw.previousClose),
      dayHigh: finiteNumber(quoteRaw.dayHigh),
      dayLow: finiteNumber(quoteRaw.dayLow),
      changePercent: finiteNumber(quoteRaw.changePercent),
    },
    arenas,
    relevantNews,
  };
}

function strategySchema(maximumHoldingMinutes: number): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      strategyCandidates: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1, maxLength: 80 },
            name: { type: "string", minLength: 1, maxLength: 120 },
            setupType: { type: "string", minLength: 1, maxLength: 120 },
            status: {
              type: "string",
              enum: ["ACTIONABLE_NOW", "WAITING_FOR_TRIGGER"],
            },
            thesis: { type: "string", minLength: 1, maxLength: 500 },
            triggerCondition: {
              type: "string",
              minLength: 1,
              maxLength: 400,
            },
            triggerPrice: { type: ["number", "null"] },
            entryPrice: { type: ["number", "null"] },
            stopLoss: { type: ["number", "null"] },
            targetPrice: { type: ["number", "null"] },
            allocationIntentPercent: {
              type: "number",
              minimum: 0,
              maximum: 100,
            },
            minimumHoldingMinutes: {
              type: ["integer", "null"],
              minimum: 1,
              maximum: maximumHoldingMinutes,
            },
            maximumHoldingMinutes: {
              type: ["integer", "null"],
              minimum: 1,
              maximum: maximumHoldingMinutes,
            },
            successEstimate: { type: "integer", minimum: 0, maximum: 100 },
            successGrade: { type: "string", enum: ["LOW", "MODERATE", "HIGH"] },
            supportingEvidence: {
              type: "array",
              maxItems: 4,
              items: { type: "string", maxLength: 220 },
            },
            opposingEvidence: {
              type: "array",
              maxItems: 4,
              items: { type: "string", maxLength: 220 },
            },
            invalidationConditions: {
              type: "array",
              maxItems: 4,
              items: { type: "string", maxLength: 220 },
            },
          },
          required: [
            "id",
            "name",
            "setupType",
            "status",
            "thesis",
            "triggerCondition",
            "triggerPrice",
            "entryPrice",
            "stopLoss",
            "targetPrice",
            "allocationIntentPercent",
            "minimumHoldingMinutes",
            "maximumHoldingMinutes",
            "successEstimate",
            "successGrade",
            "supportingEvidence",
            "opposingEvidence",
            "invalidationConditions",
          ],
        },
      },
    },
    required: ["strategyCandidates"],
  };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelayMs(attempt: number): number {
  const base = 500 * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 400);
  return Math.min(base + jitter, 4_000);
}

async function fetchOpenAIWithRetry(
  requestBody: Record<string, unknown>,
): Promise<Response> {
  let lastStatus: number | null = null;
  let lastPreview: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "X-Client-Request-Id": crypto.randomUUID(),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (response.ok || !RETRYABLE_STATUSES.has(response.status)) {
        return response;
      }

      lastStatus = response.status;
      lastPreview = (await response.text()).replace(/\s+/g, " ").slice(0, 300);

      if (attempt === MAX_ATTEMPTS) {
        throw new ApiError(
          502,
          "OPENAI_TRANSIENT_FAILURE",
          `OpenAI remained unavailable after ${attempt} attempts.`,
          { providerStatus: lastStatus, preview: lastPreview, attempts: attempt },
        );
      }

      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.max(retryAfter * 1_000, retryDelayMs(attempt))
        : retryDelayMs(attempt);

      await sleep(delay);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      const timedOut =
        error instanceof DOMException && error.name === "AbortError";

      if (attempt === MAX_ATTEMPTS) {
        throw new ApiError(
          timedOut ? 504 : 502,
          timedOut ? "OPENAI_TIMEOUT" : "OPENAI_NETWORK_ERROR",
          timedOut
            ? "OpenAI strategy generation timed out."
            : "Unable to reach OpenAI.",
          {
            attempts: attempt,
            lastStatus,
            lastPreview,
            reason: error instanceof Error ? error.message : String(error),
          },
        );
      }

      await sleep(retryDelayMs(attempt));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new ApiError(
    502,
    "OPENAI_RETRY_EXHAUSTED",
    "OpenAI retry attempts were exhausted.",
  );
}

function extractOutputText(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    throw new ApiError(
      502,
      "INVALID_OPENAI_RESPONSE",
      "OpenAI returned an invalid response object.",
    );
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text.trim();
  }

  if (Array.isArray(record.output)) {
    for (const outputItem of record.output) {
      if (typeof outputItem !== "object" || outputItem === null) {
        continue;
      }

      const content = (outputItem as Record<string, unknown>).content;

      if (!Array.isArray(content)) {
        continue;
      }

      for (const contentItem of content) {
        if (
          typeof contentItem === "object" &&
          contentItem !== null &&
          typeof (contentItem as Record<string, unknown>).text === "string"
        ) {
          return String((contentItem as Record<string, unknown>).text).trim();
        }
      }
    }
  }

  throw new ApiError(
    502,
    "OPENAI_OUTPUT_MISSING",
    "OpenAI returned no structured strategy output.",
  );
}

async function callStrategyAi(input: AnalyzeMarketRequest): Promise<unknown> {
  if (!OPENAI_API_KEY) {
    throw new ApiError(
      500,
      "OPENAI_API_KEY_MISSING",
      "OPENAI_API_KEY is not configured.",
    );
  }

  const systemPrompt = `
You are Market War Room's strategy architect.

The browser has already fetched market data, calculated indicators, scored
bull and bear evidence, assigned arena winners, and synthesized the campaign.

Your only job is to propose exactly three distinct LONG-only intraday strategy
candidates for a spectator/speculator.

Rules:
1. Use only the supplied compact evidence.
2. Do not invent missing market facts.
3. Do not calculate quantity, charges, slippage, profit, loss, ranking, or reward-to-risk.
4. Do not generate short-selling, leverage, derivative, or automatic order strategies.
5. Strategies must be distinct, not minor price variations.
6. ACTIONABLE_NOW is allowed only when the supplied evidence clearly supports immediate execution.
7. Otherwise use WAITING_FOR_TRIGGER with an exact trigger.
8. Entry must be above stop; target must be above entry.
9. Holding duration must fit inside the mission maximum.
10. successEstimate is an uncalibrated AI setup estimate, not a probability or guarantee.
11. Keep explanations concise.
12. Do not promise profit.

Return exactly three candidates in the required JSON schema.
`.trim();

  const requestBody = {
    model: OPENAI_MODEL,
    store: false,
    reasoning: {
      effort: "minimal",
    },
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: JSON.stringify(input) }],
      },
    ],
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "market_war_room_strategy_candidates",
        description: "Exactly three concise long-only strategy candidates.",
        strict: true,
        schema: strategySchema(input.mission.maximumHoldingMinutes),
      },
    },
  };

  const response = await fetchOpenAIWithRetry(requestBody);
  const contentType = response.headers.get("content-type") ?? "";
  const responseText = await response.text();

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(
      502,
      "OPENAI_NON_JSON_RESPONSE",
      "OpenAI returned a non-JSON response.",
      {
        providerStatus: response.status,
        contentType,
        preview: responseText.replace(/\s+/g, " ").slice(0, 300),
      },
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new ApiError(
      502,
      "INVALID_OPENAI_JSON",
      "OpenAI returned malformed JSON.",
      {
        providerStatus: response.status,
        preview: responseText.slice(0, 500),
      },
    );
  }

  if (!response.ok) {
    const errorRecord =
      typeof payload === "object" && payload !== null
        ? (payload as Record<string, unknown>).error
        : null;

    const message =
      typeof errorRecord === "object" &&
        errorRecord !== null &&
        typeof (errorRecord as Record<string, unknown>).message === "string"
        ? String((errorRecord as Record<string, unknown>).message)
        : "OpenAI strategy request failed.";

    throw new ApiError(response.status, "OPENAI_REQUEST_FAILED", message, {
      providerStatus: response.status,
    });
  }

  const outputText = extractOutputText(payload);

  try {
    return JSON.parse(outputText);
  } catch {
    throw new ApiError(
      502,
      "INVALID_STRATEGY_OUTPUT",
      "OpenAI returned invalid strategy JSON.",
      { preview: outputText.slice(0, 500) },
    );
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Use POST for strategy generation.",
        },
      },
      405,
    );
  }

  const startedAt = performance.now();

  try {
    const contentLength = Number(req.headers.get("content-length"));

    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      throw new ApiError(
        413,
        "REQUEST_TOO_LARGE",
        `Request body exceeds ${MAX_REQUEST_BYTES} bytes.`,
      );
    }

    const rawText = await req.text();

    if (new TextEncoder().encode(rawText).byteLength > MAX_REQUEST_BYTES) {
      throw new ApiError(
        413,
        "REQUEST_TOO_LARGE",
        `Request body exceeds ${MAX_REQUEST_BYTES} bytes.`,
      );
    }

    let rawBody: unknown;

    try {
      rawBody = JSON.parse(rawText);
    } catch {
      throw new ApiError(
        400,
        "INVALID_JSON",
        "Request body must contain valid JSON.",
      );
    }

    const input = normalizeRequest(rawBody);
    const aiStartedAt = performance.now();
    const result = await callStrategyAi(input);
    const aiLatencyMs = Math.round(performance.now() - aiStartedAt);

    return jsonResponse({
      success: true,
      data: result,
      metadata: {
        model: OPENAI_MODEL,
        candidateCount: 3,
        openAIStore: false,
        calculationsPerformed: "NONE",
        frontendResponsibilities: [
          "indicator calculation",
          "arena evidence",
          "campaign synthesis",
          "capital allocation",
          "quantity calculation",
          "charges and slippage",
          "risk and profit calculation",
          "strategy validation",
          "strategy ranking",
          "selected mission",
        ],
        latencyMs: {
          openAI: aiLatencyMs,
          total: Math.round(performance.now() - startedAt),
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("analyze-market failure", error);

    if (error instanceof ApiError) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? null,
          },
          metadata: {
            totalLatencyMs: Math.round(performance.now() - startedAt),
            generatedAt: new Date().toISOString(),
          },
        },
        error.status,
      );
    }

    return jsonResponse(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Unexpected strategy service failure.",
        },
        metadata: {
          totalLatencyMs: Math.round(performance.now() - startedAt),
          generatedAt: new Date().toISOString(),
        },
      },
      500,
    );
  }
});
