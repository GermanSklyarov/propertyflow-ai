import type { ConciergePropertyRecommendation, ConciergeResponse } from "@propertyflow/contracts";

export type ConciergeRecommendationCard = {
  fitLabel: string;
  href: string;
  propertyId: string;
  reasons: string[];
  scoreLabel: string;
  title: string;
  toneClassName: string;
  tradeoffs: string[];
};

export function buildConciergeRecommendationCards(response: ConciergeResponse | null): ConciergeRecommendationCard[] {
  if (!response || response.stage !== "recommendation") {
    return [];
  }

  return response.propertyRecommendations.map(toRecommendationCard);
}

function toRecommendationCard(recommendation: ConciergePropertyRecommendation): ConciergeRecommendationCard {
  return {
    fitLabel: getFitLabel(recommendation.fit),
    href: `/properties/${recommendation.propertyId}`,
    propertyId: recommendation.propertyId,
    reasons: recommendation.reasons,
    scoreLabel: `${Math.round(recommendation.score)} AI score`,
    title: recommendation.title,
    toneClassName: getFitToneClassName(recommendation.fit),
    tradeoffs: recommendation.tradeoffs
  };
}

function getFitLabel(fit: ConciergePropertyRecommendation["fit"]) {
  if (fit === "strong") {
    return "Strong fit";
  }

  if (fit === "moderate") {
    return "Moderate fit";
  }

  return "Needs review";
}

function getFitToneClassName(fit: ConciergePropertyRecommendation["fit"]) {
  if (fit === "strong") {
    return "border-[rgba(15,118,110,0.38)] bg-[#edf8f4] text-[var(--teal-dark)]";
  }

  if (fit === "moderate") {
    return "border-[rgba(197,154,53,0.36)] bg-[rgba(197,154,53,0.12)] text-[#604b13]";
  }

  return "border-[rgba(255,125,102,0.36)] bg-[#fff6eb] text-[#7d3b2c]";
}
