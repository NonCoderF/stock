import { RISK_POLICIES } from "./risk-policy.js";

export function validateStrategies(candidates, context) {
  const strategies = Array.isArray(candidates) ? candidates : [];
  return strategies.map((strategy, index) => {
    const plan = calculateStrategyPlan(strategy, context);
    const rejectionReasons = [];
    const policy = RISK_POLICIES[context.request.riskProfile] || RISK_POLICIES.CONTROLLED;
    const entryArena = context.evidence?.find((arena) => arena.role === "ENTRY");
    if (!(plan.entryPrice > 0)) rejectionReasons.push("Entry price must be positive.");
    if (!(plan.stopLoss < plan.entryPrice)) rejectionReasons.push("Stop loss must be below entry.");
    if (!(plan.targetPrice > plan.entryPrice)) rejectionReasons.push("Target must be above entry.");
    if (!(plan.maximumHoldingMinutes <= context.request.maximumHoldingMinutes)) rejectionReasons.push("Holding duration exceeds requested maximum.");
    if (!(plan.allocationIntentPercent <= policy.maximumAllocationPercent)) rejectionReasons.push("Allocation intent exceeds policy.");
    if (!(plan.quantity >= 1)) rejectionReasons.push("Quantity must be at least one.");
    if (!(plan.riskPlan.riskPercentOfCapital <= policy.absoluteMaximumLossPercent)) rejectionReasons.push("Maximum net risk exceeds policy.");
    if (!(plan.profitPlan.estimatedNetProfit > 0)) rejectionReasons.push("Estimated net profit must be positive.");
    if (!(plan.profitPlan.rewardRiskRatioNet >= policy.minimumRewardRiskRatio)) rejectionReasons.push("Net reward/risk below policy.");
    if (strategy.status === "ACTIONABLE_NOW" && entryArena?.signals?.candleAgeMinutes > 10) rejectionReasons.push("Actionable setup uses stale entry data.");
    if (strategy.status === "ACTIONABLE_NOW" && entryArena?.signals?.winner === "BEARS") rejectionReasons.push("Actionable setup not allowed when ENTRY is bearish.");
    if (strategy.status === "ACTIONABLE_NOW" && context.campaign?.dominance === "BEARS") rejectionReasons.push("Actionable setup not allowed when campaign is clearly bearish.");
    return {
      ...strategy,
      ...plan,
      rank: strategy.rank ?? index + 1,
      status: rejectionReasons.length ? "REJECTED" : "VALIDATED",
      rejectionReasons: [...(strategy.rejectionReasons || []), ...rejectionReasons]
    };
  });
}

function calculateStrategyPlan(strategy, context) {
  const policy = RISK_POLICIES[context.request.riskProfile] || RISK_POLICIES.CONTROLLED;
  const capital = Number(context.request.capital);
  const entryPrice = Number(strategy.entryPrice ?? strategy.entry);
  const stopLoss = Number(strategy.stopLoss ?? strategy.stop);
  const targetPrice = Number(strategy.targetPrice ?? strategy.target);
  const allocationIntentPercent = Number(strategy.allocationIntentPercent ?? policy.maximumAllocationPercent);
  const riskPerShare = Math.max(0, entryPrice - stopLoss);
  const profitPerShare = Math.max(0, targetPrice - entryPrice);
  const maxLossAmount = capital * policy.maximumLossPercent / 100;
  const quantityByRisk = riskPerShare > 0 ? Math.floor(maxLossAmount / riskPerShare) : 0;
  const allocationCap = capital * Math.min(allocationIntentPercent, policy.maximumAllocationPercent) / 100;
  const quantityByAllocation = entryPrice > 0 ? Math.floor(allocationCap / entryPrice) : 0;
  const quantity = Math.max(0, Math.min(quantityByRisk, quantityByAllocation));
  const allocationAmount = quantity * entryPrice;
  const allocationPercent = capital > 0 ? allocationAmount / capital * 100 : null;
  const cashRemaining = capital - allocationAmount;
  const grossRisk = riskPerShare * quantity;
  const estimatedCharges = allocationAmount * policy.estimatedChargesPercent / 100;
  const estimatedSlippage = allocationAmount * policy.estimatedSlippagePercent / 100;
  const maximumNetRisk = grossRisk + estimatedCharges + estimatedSlippage;
  const riskPercentOfCapital = capital > 0 ? maximumNetRisk / capital * 100 : null;
  const grossPotentialProfit = profitPerShare * quantity;
  const estimatedNetProfit = grossPotentialProfit - estimatedCharges - estimatedSlippage;
  const grossRewardRiskRatio = grossRisk > 0 ? grossPotentialProfit / grossRisk : null;
  const netRewardRiskRatio = maximumNetRisk > 0 ? estimatedNetProfit / maximumNetRisk : null;
  return {
    name: strategy.name || strategy.strategyName || `Strategy ${strategy.rank || ""}`.trim(),
    setupType: strategy.setupType || strategy.type || "CASH_EQUITY",
    entryPrice,
    stopLoss,
    targetPrice,
    allocationIntentPercent,
    quantityByRisk,
    quantityByAllocation,
    allocationAmount,
    allocationPercent,
    cashRemaining,
    quantity,
    riskPlan: {
      riskPerShare,
      grossRisk,
      estimatedCharges,
      estimatedSlippage,
      maximumNetRisk,
      riskPercentOfCapital
    },
    profitPlan: {
      profitPerShare,
      grossPotentialProfit,
      estimatedNetProfit,
      grossRewardRiskRatio,
      rewardRiskRatioNet: netRewardRiskRatio
    },
    maxNetRisk: maximumNetRisk,
    maximumNetRisk,
    estimatedNetProfit,
    grossRewardRiskRatio,
    rewardRiskRatioNet: netRewardRiskRatio,
    minimumHoldingMinutes: Number(strategy.minimumHoldingMinutes ?? strategy.holdingDurationMinutes ?? 1),
    maximumHoldingMinutes: Number(strategy.maximumHoldingMinutes ?? context.request.maximumHoldingMinutes),
    holdingDurationMinutes: Number(strategy.maximumHoldingMinutes ?? context.request.maximumHoldingMinutes)
  };
}
