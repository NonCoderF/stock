export const RISK_POLICIES = {
  CONSERVATIVE: {
    maximumLossPercent: 0.5,
    absoluteMaximumLossPercent: 0.75,
    maximumAllocationPercent: 50,
    minimumRewardRiskRatio: 2.5,
    estimatedChargesPercent: 0.15,
    estimatedSlippagePercent: 0.15
  },
  CONTROLLED: {
    maximumLossPercent: 1,
    absoluteMaximumLossPercent: 1.25,
    maximumAllocationPercent: 70,
    minimumRewardRiskRatio: 2,
    estimatedChargesPercent: 0.15,
    estimatedSlippagePercent: 0.15
  },
  AGGRESSIVE: {
    maximumLossPercent: 1.5,
    absoluteMaximumLossPercent: 2,
    maximumAllocationPercent: 90,
    minimumRewardRiskRatio: 1.5,
    estimatedChargesPercent: 0.15,
    estimatedSlippagePercent: 0.2
  }
};

export const PAPER_RISK_POLICIES = {
  CONSERVATIVE: {
    maximumRiskPercent: 0.5,
    maximumAllocationPercent: 50,
    estimatedChargesPercent: 0.15,
    estimatedSlippagePercent: 0.10
  },

  CONTROLLED: {
    maximumRiskPercent: 1.0,
    maximumAllocationPercent: 70,
    estimatedChargesPercent: 0.15,
    estimatedSlippagePercent: 0.15
  },

  AGGRESSIVE: {
    maximumRiskPercent: 1.5,
    maximumAllocationPercent: 90,
    estimatedChargesPercent: 0.15,
    estimatedSlippagePercent: 0.20
  }
};

export function buildCapitalPlan(request, campaign, entryArena) {
  const policy = RISK_POLICIES[request.riskProfile] || RISK_POLICIES.CONTROLLED;
  const capital = Number(request.capital);
  const entryPrice = entryArena?.signals?.latestPrice;
  const atr = entryArena?.signals?.atr14 || entryPrice * 0.008;
  if (!Number.isFinite(capital) || !Number.isFinite(entryPrice) || entryPrice <= 0) {
    return { availableCapital: capital, allocationAmount: 0, allocationPercent: 0, cashRemaining: capital };
  }
  const allocationAmount = Math.floor(capital * policy.maximumAllocationPercent / 100);
  const quantity = Math.max(0, Math.floor(allocationAmount / entryPrice));
  const stopLoss = campaign.currentDominance === "BULLS" ? entryPrice - atr : entryPrice - atr * 0.8;
  const targetPrice = entryPrice + atr * policy.minimumRewardRiskRatio;
  const grossPlannedLoss = Math.max(0, (entryPrice - stopLoss) * quantity);
  const grossExpectedProfit = Math.max(0, (targetPrice - entryPrice) * quantity);
  const estimatedCharges = allocationAmount * policy.estimatedChargesPercent / 100;
  const estimatedSlippage = allocationAmount * policy.estimatedSlippagePercent / 100;
  const maximumNetPlannedLoss = grossPlannedLoss + estimatedCharges + estimatedSlippage;
  const estimatedNetProfit = grossExpectedProfit - estimatedCharges - estimatedSlippage;
  return {
    availableCapital: capital,
    allocationAmount,
    allocationPercent: policy.maximumAllocationPercent,
    cashRemaining: capital - allocationAmount,
    quantity,
    entryPrice,
    stopLoss,
    targetPrice,
    grossPlannedLoss,
    estimatedCharges,
    estimatedSlippage,
    maximumNetPlannedLoss,
    grossExpectedProfit,
    estimatedNetProfit,
    rewardRiskRatioGross: grossPlannedLoss > 0 ? grossExpectedProfit / grossPlannedLoss : null,
    rewardRiskRatioNet: maximumNetPlannedLoss > 0 ? estimatedNetProfit / maximumNetPlannedLoss : null,
    policy
  };
}
