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

Each strategy may also include:

```js
strategy.simulationProposal
strategy.simulationPlan
```

`simulationPlan` is the server-deterministic read-only paper-trade plan for that strategy. It can include eligibility, status, available capital, applied allocation percentage, allocation amount, entry price, stop-loss price, target price, quantity, invested amount, cash reserve, risk per share, projected net loss at stop, projected net profit at target, reward-to-risk values, maximum holding minutes, entry condition, exit conditions, rejection reasons, and disclaimer.

The response may also include:

```js
payload.data.paperTrading
```

`paperTrading` describes the paper-only account context, including enabled state, mode, initial capital, currency, equity, P&L placeholders, execution authority, entry price policy, exit priority, and safety disclaimer.

The frontend no longer expects `data.strategyCandidates`, `data.strategyBook`, or `data.decision.strategyBook`.

## Paper Trade Simulation Card

Below the three Commander mission cards, the frontend renders one additional `PAPER TRADE SIMULATION` card when both `data.paperTrading` and a selected strategy `simulationPlan` are available.

The strategy selection rule is:

1. Prefer the first strategy whose `simulationPlan.eligible === true`.
2. Fall back to the `BEST_OPPORTUNITY` strategy.
3. Fall back to the first strategy.

The selected plan is reconciled locally with the deterministic bull-vs-bear signal before display. If the local signal is `SELL` or `STRONG_SELL`, the card never displays `READY FOR PAPER ENTRY`; the plan is marked `NO_SIMULATED_ENTRY` with a rejection reason from the browser. If the local signal is `WAIT` and the server says ready, the card displays `WAITING FOR TRIGGER`.

The card displays the paper account state, selected strategy, readiness status, capital and allocation, quantity, entry/stop/target price plan, risk per share, gross and net reward-to-risk, maximum holding time, projected net loss at stop, projected net profit at target, projected return percentage, entry condition, exit conditions, rejection reasons, and disclaimer.

Projected P&L is labeled as projected only. The card always shows:

```text
SIMULATION ONLY
NO REAL ORDER PLACED
PROJECTED P&L IS NOT GUARANTEED
```

This phase is a read-only preview. It does not open a simulated position, deduct wallet cash, update unrealized P&L, auto-close at stop or target, or persist trade history. Those behaviors belong to a future live paper-position phase.

## Running Man Persistence

Running Man stores a timestamped sequence of observations so the system can later replay how market evidence, AI strategies, and paper-trade plans evolved.

The browser creates one stable `runId` for an active observation session and sends a zero-based `observationNo` with each `analyze-market` request:

```json
{
  "mission": {},
  "quote": {},
  "arenas": [],
  "relevantNews": [],
  "runId": "a1b2c3d4-...",
  "observationNo": 0
}
```

The first observation in a run is `0`, then `1`, `2`, `3`, and so on. A live polling loop keeps the same `runId`; it does not create a new UUID for every poll. The `New Run` control starts a fresh run without automatically triggering market analysis.

The backend may return:

```js
payload.data.persistence
```

with informational fields such as `enabled`, `status`, `table`, `runId`, `observationNo`, `rowId`, `persistedAt`, and `error`. Supported statuses are `SAVED`, `SKIPPED`, and `ERROR`.

Persistence is a separate error domain. A persistence failure is logged and shown as a compact non-blocking warning:

```text
History save failed. Analysis remains available.
```

It does not replace market errors, does not count as a strategy error, does not hide strategies, does not block paper-trade rendering, and never changes the local bull-vs-bear authority.

Running Man client state is stored in SessionStorage under:

```text
market-war-room:running-man
```

The stored client state includes `runId`, the next `observationNo`, whether the run is active, the last persistence summary, and the started timestamp. A new browser session may create a new run.

The local observation timeline stores compact persistence metadata only: observed time, shortened run ID, observation number, saved state, persisted timestamp, signal, bull strength, and bear strength. It does not store the full backend persistence response for every timeline item.

The existing `data.strategies` and `data.paperTrading` nodes remain backward compatible. Future phases can build replay dashboards or richer forward-observation history from the persisted Running Man rows.

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
