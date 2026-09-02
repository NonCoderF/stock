![Screenshot](screenshot.png)
# MARKET WAR ROOM

MARKET WAR ROOM is a standalone static command-center interface for a deterministic bull-vs-bear market signal. It is not a trading platform, does not place orders, and has no broker integration.

## Product Philosophy

The user is a spectator with limited capital. The browser observes multiple timeframe battlefields, renders local market intelligence, and calculates the authoritative bull-vs-bear signal locally.

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
    "https://jmyqvrvrguhfujgombqe.supabase.co/functions/v1/market"
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

Raw candles are used for the chart and local indicators. No compact evidence is sent to a strategy or analysis service.

## Frontend Paper Engine

The browser owns the deterministic paper engine:

```text
MARKET API
    -> FRONTEND DETERMINISTIC ENGINE
       -> indicators
       -> bull/bear evidence
       -> campaign
       -> BUY / WAIT / SELL
       -> paper position sizing
       -> simulated entry
       -> paper wallet
       -> live mark-to-market P&L
       -> stop / target / time / signal exit
       -> Running Man client snapshot
```

The paper wallet is persisted in localStorage:

```text
market-war-room:paper-account:v1
```

It stores starting capital, cash, equity, realized P&L, unrealized P&L, the open paper position, and closed paper trades. This is browser state, not broker state; it can be edited or cleared by the user and should not be treated as trusted financial records.

Position sizing uses local risk policy by profile:

- `CONSERVATIVE`: 0.5% max risk, 50% max allocation
- `CONTROLLED`: 1.0% max risk, 70% max allocation
- `AGGRESSIVE`: 1.5% max risk, 90% max allocation

The manual paper entry does not depend on AI proposal fields, stop-loss, target, or allocation math. It buys one paper share at the latest valid quote and holds it for `request.maximumHoldingMinutes`.

Opening rules:

- no paper position is already open
- latest market quote must be valid
- paper cash must cover one share plus estimated entry charges
- selected holding time must be valid

The actual simulated entry always uses the latest market quote available in the browser.

Mark-to-market P&L, elapsed-time exit, wallet updates, manual paper exit, and reset behavior run instantly in the browser. These operations do not call OpenAI or an analysis endpoint.

Exit reasons are:

- `MAXIMUM_HOLDING_TIME`
- `MANUAL_PAPER_EXIT`

Safety copy is always shown:

```text
PAPER TRADING ONLY
NO REAL ORDER IS PLACED
SIMULATED P&L DOES NOT GUARANTEE REAL-WORLD RESULTS
```

## Running Man Persistence

Running Man stores a timestamped sequence of local observations so the system can later replay how market evidence and paper-trade state evolved.

The browser creates one stable `runId` for an active observation session and increments a zero-based `observationNo` for each local observation.

The first observation in a run is `0`, then `1`, `2`, `3`, and so on. A live polling loop keeps the same `runId`; it does not create a new UUID for every poll. The `New Run` control starts a fresh run without automatically triggering market analysis.

Running Man client state is stored in SessionStorage under:

```text
market-war-room:running-man
```

The stored client state includes `runId`, the next `observationNo`, whether the run is active, the last persistence summary, and the started timestamp. A new browser session may create a new run.

The local observation timeline stores compact metadata only: observed time, shortened run ID, observation number, signal, bull strength, and bear strength.

## Commander Mapping

Commander uses only the deterministic market signal.

Signal mapping:

- `STRONG_BUY` -> `JOIN THE BULLS`
- `BUY` -> `BULLS HAVE THE EDGE`
- `WAIT` -> `NO CLEAR WINNER`
- `SELL` -> `STAY AWAY FROM LONGS`
- `STRONG_SELL` -> `BEARS CONTROL THE FIELD`

## Loading Behavior

The battlefield renders after the market engine completes:

```text
EAGLE VIEW READY
```

## SessionStorage

The app stores:

```text
market-war-room:last-request
market-war-room:last-response
```

## Safety Notice

Local estimates are not historical probabilities or guarantees. Market data may be delayed or incomplete. No order is placed by this application.

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
