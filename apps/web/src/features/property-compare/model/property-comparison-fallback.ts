import type { PropertyComparisonResponse, PropertyComparisonWinner } from "@propertyflow/contracts";
import type { PropertyPurpose, PropertySnapshot } from "@propertyflow/domain";
import { buildCompareInsights } from "./compare-insights";

const purposeLabels: Record<PropertyPurpose, string> = {
  family: "family use",
  investment: "investment",
  living: "daily living",
  relocation: "relocation"
};

const insightPurposeMap = {
  "Family fit": "family",
  Investment: "investment",
  "Winter living": "living"
} as const;

export function buildFallbackPropertyComparison(properties: PropertySnapshot[]): PropertyComparisonResponse {
  const comparableProperties = properties.slice(0, 3);
  const insights = buildCompareInsights(comparableProperties);
  const winners = insights.map((insight): PropertyComparisonWinner => {
    const purpose = insightPurposeMap[insight.label];

    return {
      explanation: `${insight.reason} ${insight.signals[0] ?? "Strongest available signal."}`,
      propertyId: insight.property.id,
      purpose,
      score: scoreWinner(insight.property, purpose),
      title: insight.property.title
    };
  });

  if (comparableProperties.length && !winners.some((winner) => winner.purpose === "relocation")) {
    const relocationWinner = pickRelocationWinner(comparableProperties);

    winners.push({
      explanation: "Best balance of living comfort, internet, and low-friction arrival for a move.",
      propertyId: relocationWinner.id,
      purpose: "relocation",
      score: scoreWinner(relocationWinner, "relocation"),
      title: relocationWinner.title
    });
  }

  return {
    comparedPropertyIds: comparableProperties.map((property) => property.id),
    scores: winners.map((winner) => ({
      propertyId: winner.propertyId,
      purpose: winner.purpose,
      reasons: [winner.explanation],
      score: winner.score,
      title: winner.title
    })),
    summary: buildSummary(winners),
    winners
  };
}

function pickRelocationWinner(properties: PropertySnapshot[]) {
  return properties.reduce((bestProperty, property) =>
    scoreWinner(property, "relocation") > scoreWinner(bestProperty, "relocation") ? property : bestProperty
  );
}

function scoreWinner(property: PropertySnapshot, purpose: PropertyPurpose) {
  const beachScore = property.beachDistanceMeters ? Math.max(0, 1_200 - property.beachDistanceMeters) / 160 : 0;
  const rentYieldScore =
    property.monthlyRentEstimate && property.price.amount > 0
      ? (property.monthlyRentEstimate.amount * 12 * 100) / property.price.amount
      : 0;

  if (purpose === "investment") {
    return Number((rentYieldScore + beachScore / 2).toFixed(1));
  }

  if (purpose === "family") {
    return Number((property.bedrooms * 2 + property.areaSqm / 35).toFixed(1));
  }

  return Number((property.areaSqm / 30 + beachScore + (hasRemoteWorkSignal(property) ? 2 : 0)).toFixed(1));
}

function hasRemoteWorkSignal(property: PropertySnapshot) {
  return property.amenities.some((amenity) => amenity.includes("internet") || amenity.includes("coworking"));
}

function buildSummary(winners: PropertyComparisonWinner[]) {
  if (!winners.length) {
    return "Select 2-3 listings to generate an AI comparison.";
  }

  return winners
    .map((winner) => `${winner.title} leads for ${purposeLabels[winner.purpose]} with score ${winner.score}.`)
    .join(" ");
}
