# MARKET WAR ROOM

MARKET WAR ROOM is a standalone static command-center interface for a deterministic bull-vs-bear market signal with AI explanation. It is not a trading platform, does not place orders, and has no broker integration.

## Product Philosophy

The user is a spectator with limited capital. The browser observes multiple timeframe battlefields, renders local market intelligence, calculates the authoritative bull-vs-bear signal, then asks Commander AI for three concise human-readable paths:

1. Best Opportunity
2. Safer Alternative
3. Capital Protection

## Project Structure

```text
market-war-room/
├── index.html
├── styles.css
├── app.js
├── config.js
├── favicon.svg
├── README.md
└── js/
```

The app uses HTML5, CSS3, vanilla JavaScript, Browser Fetch API, responsive SVG, and SessionStorage. There is no React, Vue, Angular, npm requirement, bundler, or chart library.

## Endpoints

Configured in `config.js`:

```js
window.APP_CONFIG = {
  MARKET_URL:
    "https://jmyqvrvrguhfujgombqe.supabase.co/functions/v1/market",
  ANALYZE_MARKET_URL:
    "https://jmyqvrvrguhfujgombqe.supabase.co/functions/v1/analyze-market"
};
```

No secrets belong in frontend files.

## Market Engine

The frontend calls `/market` for the selected timeframe arenas and keeps partial success visible. One failed arena does not hide successful arenas.

The browser calculates local market intelligence, including:

- SMA, EMA, RSI, ATR, returns, relative volume
- recent highs and lows
- candle freshness
- bull and bear evidence
- arena winner and momentum
- campaign dominance
- deterministic BUY / WAIT / SELL signal

## Deterministic Signal Engine

The local bull-vs-bear engine is the only authority for Commander direction.

```text
difference = bullStrength - bearStrength
```

Exact thresholds:

```text
difference >= +20     STRONG_BUY
difference +8 to +19  BUY
difference -7 to +7   WAIT
difference -19 to -8  SELL
difference <= -20     STRONG_SELL
```

For `SELL` and `STRONG_SELL`, this long-only application displays:

```text
LONG ACTION: DO NOT BUY
```

It does not imply short selling or automatic order execution.

Signal confidence is calculated locally from the bull-bear difference and arena alignment. It is labeled `SIGNAL CONFIDENCE`, never probability of profit.

Raw candles are used for the chart and local indicators. Raw candles are not sent to `analyze-market`.

## Analyze Market Request

The frontend sends compact evidence only:

```json
{
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
  "arenas": [],
  "relevantNews": []
}
```

## Human-Readable Strategy Response

The frontend reads the strategy response from:

```js
payload.data.strategies
```

The endpoint returns exactly three strategies:

- `BEST_OPPORTUNITY`
- `SAFER_ALTERNATIVE`
- `CAPITAL_PROTECTION`

Each card displays category, title, action, confidence, risk level, holding time, entry, stop loss, target, reasons, and summary.

The frontend no longer expects `data.strategyCandidates`, `data.strategyBook`, or `data.decision.strategyBook`.

## Commander Mapping

Commander uses only the deterministic market signal. AI strategy actions cannot override it.

Signal mapping:

- `STRONG_BUY` -> `JOIN THE BULLS`
- `BUY` -> `BULLS HAVE THE EDGE`
- `WAIT` -> `NO CLEAR WINNER`
- `SELL` -> `STAY AWAY FROM LONGS`
- `STRONG_SELL` -> `BEARS CONTROL THE FIELD`

## AI Advisory Role

AI may explain the battlefield and suggest strategy cards, but it cannot decide Commander action.

If AI returns `BUY_NOW` while the local signal is `WAIT`, the card is downgraded to `WAIT`.

If AI returns `BUY_NOW` while the local signal is `SELL` or `STRONG_SELL`, the card is rejected with a `LOCAL ENGINE OVERRIDE` badge.

## Loading Behavior

The battlefield renders before AI completes:

```text
EAGLE VIEW READY
Commander AI is designing three missions...
```

The market chart and arenas remain visible while strategy generation is running.

## Retry Commander

`Retry Commander` calls only `/analyze-market` using the latest compact evidence. It does not refetch `/market`.

## SessionStorage

The app stores:

```text
market-war-room:last-request
market-war-room:last-response
market-war-room:last-strategies
```

`last-strategies` stores only:

```js
{
  strategies,
  metadata,
  savedAt
}
```

Raw OpenAI payloads are not persisted.

## Safety Notice

AI-generated plans are uncalibrated model assessments, not historical probabilities or guarantees. AI explanations and strategies cannot override the local market signal. Market data may be delayed or incomplete. No order is placed by this application.

## Local Development

From inside `market-war-room`:

```bash
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

Alternative:

```bash
npx serve .
```

## Static Deployment

GitHub Pages: publish the `market-war-room` folder or copy its contents to the Pages root.

Netlify: no build command; publish directory is `market-war-room` or `.` when deploying from inside the folder.

Vercel static hosting: leave build command empty and set output directory to `market-war-room` or deploy from inside the folder.

Cloudflare Pages: leave build command empty and set output directory to `market-war-room`.
