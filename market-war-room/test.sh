curl -X POST \
  "https://jmyqvrvrguhfujgombqe.supabase.co/functions/v1/analyze-market" \
  -H "Content-Type: application/json" \
  -d '{
    "mission": {
      "symbol": "RELIANCE",
      "exchange": "NSE",
      "capital": 10000,
      "riskProfile": "CONTROLLED",
      "maximumHoldingMinutes": 30
    },
    "quote": {
      "price": 1287.8,
      "previousClose": 1292.9,
      "dayHigh": 1299,
      "dayLow": 1286,
      "changePercent": -0.394
    },
    "arenas": [
      {
        "label": "5 Minute Arena",
        "role": "ENTRY",
        "interval": "5m",
        "winner": "BEARS",
        "latestPrice": 1287.8,
        "bullEvidence": 43,
        "bearEvidence": 71,
        "momentum": "FALLING"
      },
      {
        "label": "15 Minute Arena",
        "role": "CONFIRMATION",
        "interval": "15m",
        "winner": "BEARS",
        "latestPrice": 1287.8,
        "bullEvidence": 46,
        "bearEvidence": 68,
        "momentum": "FALLING"
      },
      {
        "label": "1 Hour Arena",
        "role": "CONTEXT",
        "interval": "1h",
        "winner": "BALANCED",
        "latestPrice": 1287.8,
        "bullEvidence": 54,
        "bearEvidence": 59,
        "momentum": "MIXED"
      }
    ],
    "relevantNews": []
  }'