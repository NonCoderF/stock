export function buildCampaign(arenaEvidence) {
  const totals = arenaEvidence.reduce((acc, arena) => {
    const weight = Number(arena.weight) || 0;
    acc.bull += (arena.signals.deterministicBullEvidence || 0) * weight;
    acc.bear += (arena.signals.deterministicBearEvidence || 0) * weight;
    acc.confidence += Math.abs((arena.signals.deterministicBullEvidence || 0) - (arena.signals.deterministicBearEvidence || 0)) * weight;
    return acc;
  }, { bull: 0, bear: 0, confidence: 0 });
  const bullStrength = Math.round(totals.bull);
  const bearStrength = Math.round(totals.bear);
  const currentDominance = Math.abs(bullStrength - bearStrength) < 8 ? "BALANCED" : bullStrength > bearStrength ? "BULLS" : "BEARS";
  return {
    dominance: currentDominance,
    currentDominance,
    bullStrength,
    bearStrength,
    confidence: Math.max(35, Math.min(95, Math.round(50 + totals.confidence / 2))),
    marketEmotion: currentDominance === "BULLS" ? "OPTIMISM" : currentDominance === "BEARS" ? "CAUTION" : "UNCERTAINTY",
    battleState: campaignSentence(currentDominance),
    timeframeBattles: arenaEvidence.map((arena) => ({
      timeframe: arena.label,
      role: arena.role,
      winner: arena.signals.preliminaryWinner,
      bullStrength: arena.signals.deterministicBullEvidence,
      bearStrength: arena.signals.deterministicBearEvidence,
      momentum: arena.signals.momentum,
      confidence: Math.round(Math.abs(arena.signals.deterministicBullEvidence - arena.signals.deterministicBearEvidence) + 45),
      narrative: `${arena.role} arena currently favors ${arena.signals.preliminaryWinner.toLowerCase()}.`,
      weight: arena.weight
    })),
    likelyScenario: currentDominance === "BULLS" ? "Bullish continuation remains possible while entry evidence holds." : "Capital defense remains favored until bulls reclaim evidence.",
    alternativeScenario: "A shift in entry momentum can change the next mission candidate.",
    invalidationNarrative: "Campaign view changes when weighted arena evidence flips."
  };
}

function campaignSentence(dominance) {
  if (dominance === "BULLS") return "Bulls control the weighted campaign.";
  if (dominance === "BEARS") return "Bears control the weighted campaign.";
  return "The campaign remains contested.";
}
