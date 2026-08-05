export async function fetchHumanReadableStrategies(payload, signal) {
  const response = await fetch(window.APP_CONFIG.ANALYZE_MARKET_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Analyze Market returned invalid JSON.");
  }

  if (!response.ok || result.success !== true) {
    const error = new Error(result?.error?.message || "Strategy generation failed.");
    error.code = result?.error?.code || null;
    error.status = response.status;
    error.details = result?.error?.details || null;
    throw error;
  }

  const strategies = result?.data?.strategies;

  if (!Array.isArray(strategies)) {
    throw new Error("Analyze Market response did not contain data.strategies.");
  }

  if (strategies.length !== 3) {
    throw new Error(`Expected exactly 3 strategies but received ${strategies.length}.`);
  }

  return {
    strategies,
    metadata: result?.metadata || {}
  };
}
