export function formatCurrency(value) {
  if (value == null || value === "") {
    return "\u2014";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "\u2014";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(number);
}

export function formatNumber(value) {
  if (value == null || value === "") {
    return "\u2014";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "\u2014";
  }

  return number.toFixed(2);
}

export function formatInteger(value) {
  if (value == null || value === "") {
    return "\u2014";
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? String(Math.max(0, Math.floor(number)))
    : "0";
}

export function formatPercent(value) {
  if (value == null || value === "") {
    return "\u2014";
  }

  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)}%` : "\u2014";
}

export function formatHoldingMinutes(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "No position";
  }

  return `${number} min`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function elapsedMinutesSince(isoDate) {
  const started = new Date(isoDate).getTime();
  if (!Number.isFinite(started)) return "\u2014";
  const elapsed = Math.max(0, (Date.now() - started) / 60000);
  return `${elapsed.toFixed(1)} min`;
}
