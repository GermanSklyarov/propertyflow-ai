import type { PropertySnapshot } from "@propertyflow/domain";

export type CompareInsight = {
  label: "Investment" | "Winter living" | "Family fit";
  property: PropertySnapshot;
  reason: string;
};

export function buildCompareInsights(properties: PropertySnapshot[]): CompareInsight[] {
  if (!properties.length) {
    return [];
  }

  return [
    {
      label: "Investment",
      property: pickBest(properties, investmentScore),
      reason: "Best gross yield signal among the selected listings."
    },
    {
      label: "Winter living",
      property: pickBest(properties, winterLivingScore),
      reason: "Strongest day-to-day fit for beach access, internet, and calmer living."
    },
    {
      label: "Family fit",
      property: pickBest(properties, familyScore),
      reason: "Most comfortable selected option for space, bedrooms, and quieter area fit."
    }
  ];
}

function pickBest(properties: PropertySnapshot[], score: (property: PropertySnapshot) => number) {
  return properties.reduce((bestProperty, property) => (score(property) > score(bestProperty) ? property : bestProperty));
}

function investmentScore(property: PropertySnapshot) {
  if (!property.monthlyRentEstimate || property.price.amount <= 0) {
    return 0;
  }

  return (property.monthlyRentEstimate.amount * 12) / property.price.amount;
}

function winterLivingScore(property: PropertySnapshot) {
  const beachScore = property.beachDistanceMeters ? Math.max(0, 1_200 - property.beachDistanceMeters) / 1_200 : 0;
  const internetScore = property.amenities.some((amenity) => amenity.includes("internet") || amenity.includes("coworking")) ? 1 : 0;
  const quietScore = property.address?.toLowerCase().includes("jomtien") || property.address?.toLowerCase().includes("wongamat") ? 1 : 0;

  return beachScore + internetScore + quietScore;
}

function familyScore(property: PropertySnapshot) {
  const quietScore = property.address?.toLowerCase().includes("jomtien") ? 1.5 : 0;
  const familyAmenityScore = property.amenities.some((amenity) => amenity.includes("family") || amenity.includes("playground"))
    ? 1
    : 0;

  return property.bedrooms * 1.4 + property.areaSqm / 60 + quietScore + familyAmenityScore;
}
