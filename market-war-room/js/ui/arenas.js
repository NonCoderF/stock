import { escape, metric, percent, title } from "./market-view.js";

export function renderBattle(root, decision) {
  const spec = decision.speculation || {};
  root.battleCard.innerHTML = `
    <div>
      <p class="section-label">EAGLE VIEW</p>
      <h2 class="${winnerClass(spec.currentDominance)}">${escape(title(spec.currentDominance))}</h2>
    </div>
    <div class="battle-bars">
      ${bar("Bulls", spec.bullStrength, "bull")}
      ${bar("Bears", spec.bearStrength, "bear")}
    </div>
    <div class="battle-copy">
      <span><strong>Campaign</strong>${escape(spec.battleState)}</span>
      <span><strong>Confidence</strong>${escape(percent(spec.confidence))}</span>
      <span><strong>Emotion</strong>${escape(title(spec.marketEmotion))}</span>
    </div>
  `;
}

export function renderArenas(root, arenas) {
  root.arenasSection.innerHTML = `
    <p class="section-label">LOCAL MARKET ENGINE</p>
    <h2>ARENAS</h2>
    <div class="battlefield-map">
      ${arenas.map(renderArena).join("")}
    </div>
  `;
}

function renderArena(arena) {
  const signals = arena.signals || {};
  return `
    <article class="arena-card">
      <div class="arena-body">
        <div class="arena-head"><h3>${escape(arena.label)}</h3><span class="pill">${escape(arena.role)}</span></div>
        <div class="arena-key-grid">
          ${metric("Winner", title(signals.preliminaryWinner))}
          ${metric("Bull", signals.deterministicBullEvidence)}
          ${metric("Bear", signals.deterministicBearEvidence)}
          ${metric("RSI", signals.rsi14?.toFixed?.(1))}
          ${metric("EMA", signals.ema9 > signals.ema21 ? "9>21" : "9<21")}
          ${metric("Volume", signals.volumeRatio20?.toFixed?.(2))}
        </div>
      </div>
    </article>
  `;
}

function bar(label, value, type) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="war-bar ${type}"><div class="war-bar-head"><span>${label}</span><strong>${value ?? "—"}</strong></div><div class="war-track"><span style="width:${width}%"></span></div></div>`;
}

function winnerClass(value) {
  if (value === "BULLS") return "winner-bulls";
  if (value === "BEARS") return "winner-bears";
  if (value === "BALANCED") return "winner-balanced";
  return "winner-unknown";
}
