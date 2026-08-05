export function rankStrategies(strategies) {
  return [...strategies]
    .map((strategy) => ({ ...strategy, score: calculateStrategyScore(strategy) }))
    .sort((a, b) => Number(b.score) - Number(a.score))
    .map((strategy, index) => ({ ...strategy, rank: index + 1 }));
}

export function calculateStrategyScore(strategy) {
  if (strategy.status === "REJECTED") return -1000;
  const rewardRiskScore = Math.min(strategy.profitPlan?.rewardRiskRatioNet || 0, 5) * 24;
  const successScore = Number(strategy.successEstimate || 0) * 0.45;
  const executionScore = strategy.status === "ACTIONABLE_NOW" ? 16 : 8;
  const riskPenalty = Number(strategy.riskPlan?.riskPercentOfCapital || 0) * 4;
  return rewardRiskScore + successScore + executionScore - riskPenalty;
}
