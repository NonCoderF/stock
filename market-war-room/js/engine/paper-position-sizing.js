export function calculatePaperQuantity({
  capital,
  entryPrice,
  stopLoss,
  allocationPercent,
  maximumRiskPercent
}) {
  const availableCapital = Number(capital);
  const entry = Number(entryPrice);
  const stop = Number(stopLoss);
  const allocation = Number(allocationPercent);
  const riskPercent = Number(maximumRiskPercent);

  if (
    !Number.isFinite(availableCapital) ||
    !Number.isFinite(entry) ||
    !Number.isFinite(stop) ||
    !Number.isFinite(allocation) ||
    !Number.isFinite(riskPercent)
  ) {
    return 0;
  }

  if (
    availableCapital <= 0 ||
    entry <= 0 ||
    stop <= 0 ||
    stop >= entry
  ) {
    return 0;
  }

  const allocationBudget = availableCapital * (allocation / 100);
  const maximumRiskAmount = availableCapital * (riskPercent / 100);
  const riskPerShare = entry - stop;
  const quantityByCapital = Math.floor(allocationBudget / entry);
  const quantityByRisk = Math.floor(maximumRiskAmount / riskPerShare);

  return Math.max(0, Math.min(quantityByCapital, quantityByRisk));
}
