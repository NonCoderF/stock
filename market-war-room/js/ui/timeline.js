import { escape, display } from "./market-view.js";

export function renderTimeline(root, observations) {
  root.timelineSection.innerHTML = `
    <p class="section-label">BATTLE TIMELINE</p>
    <h2>OBSERVATION LOG</h2>
    <ol class="timeline-list">
      ${(observations || []).map(renderEvent).join("") || `<li class="timeline-event"><strong>STANDBY</strong></li>`}
    </ol>
  `;
}

function renderEvent(item) {
  const signal = item.signal;

  if (!signal) {
    return `
      <li class="timeline-event">
        <span class="timeline-time">${escape(new Date(item.time).toLocaleTimeString())}</span>
        <strong>${escape(display(item.action))}</strong>
        <p>${escape(display(item.summary))}</p>
      </li>
    `;
  }

  return `
    <li class="timeline-event">
      <span class="timeline-time">${escape(new Date(item.time).toLocaleTimeString())}</span>
      <strong>SIGNAL: ${escape(display(signal.signal))}</strong>
      <p>BULLS: ${escape(display(signal.bullStrength))}</p>
      <p>BEARS: ${escape(display(signal.bearStrength))}</p>
      <p>DIFFERENCE: ${escape(display(signal.difference))}</p>
      <p>LONG ACTION: ${escape(formatLongAction(signal.longAction))}</p>
    </li>
  `;
}

function formatLongAction(value) {
  if (value === "DO_NOT_BUY") return "DO NOT BUY";
  return display(value);
}
