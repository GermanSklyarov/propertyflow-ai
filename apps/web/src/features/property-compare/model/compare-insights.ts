import type { PropertySnapshot } from "@propertyflow/domain";

export type CompareInsight = {
  label: "Investment" | "Winter living" | "Family fit";
  property: PropertySnapshot;
  reason: string;
  signals: string[];
  tradeoffs: string[];
};

export function buildCompareInsights(properties: PropertySnapshot[]): CompareInsight[] {
  if (!properties.length) {
    return [];
  }

  return [
    {
      label: "Investment",
      property: pickBest(properties, investmentScore),
      reason: "Best gross yield signal among the selected listings.",
      signals: investmentSignals(pickBest(properties, investmentScore)),
      tradeoffs: investmentTradeoffs(pickBest(properties, investmentScore))
    },
    {
      label: "Winter living",
      property: pickBest(properties, winterLivingScore),
      reason: "Strongest day-to-day fit for beach access, internet, and calmer living.",
      signals: winterLivingSignals(pickBest(properties, winterLivingScore)),
      tradeoffs: winterLivingTradeoffs(pickBest(properties, winterLivingScore))
    },
    {
      label: "Family fit",
      property: pickBest(properties, familyScore),
      reason: "Most comfortable selected option for space, bedrooms, and quieter area fit.",
      signals: familySignals(pickBest(properties, familyScore)),
      tradeoffs: familyTradeoffs(pickBest(properties, familyScore))
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

function investmentSignals(property: PropertySnapshot) {
  return [
    property.monthlyRentEstimate ? `${formatYield(property)} gross yield signal` : "Rent estimate still pending",
    property.beachDistanceMeters && property.beachDistanceMeters <= 600 ? "Beach access supports short-stay demand" : "Demand depends more on area fit",
    property.listingType === "sale_or_rent" ? "Owner can test sale or rental strategy" : "Single listing strategy"
  ];
}

function investmentTradeoffs(property: PropertySnapshot) {
  return [
    property.maintenanceFeeMonthly ? "Net yield should include maintenance fee" : "Maintenance fee needs confirmation",
    property.floor && property.floor > 18 ? "High floor heat and lift wait should be checked" : "Street noise and view need inspection"
  ];
}

function winterLivingSignals(property: PropertySnapshot) {
  return [
    property.beachDistanceMeters ? `${property.beachDistanceMeters}m to beach` : "Beach distance needs confirmation",
    property.amenities.some((amenity) => amenity.includes("internet") || amenity.includes("coworking"))
      ? "Remote-work signal is present"
      : "Internet quality needs agent confirmation",
    isQuietArea(property) ? "Calmer residential area signal" : "More active city-area profile"
  ];
}

function winterLivingTradeoffs(property: PropertySnapshot) {
  return [
    property.listingType === "rent" ? "Lease terms and deposit still need confirmation" : "Ownership costs need legal check",
    property.bedrooms < 2 ? "Compact layout may be tight for longer stays" : "Larger layout may cost more to maintain"
  ];
}

function familySignals(property: PropertySnapshot) {
  return [
    `${property.bedrooms} bedrooms and ${property.areaSqm} sqm`,
    property.amenities.some((amenity) => amenity.includes("family") || amenity.includes("playground"))
      ? "Family amenity signal is present"
      : "Family amenities need building-level check",
    property.address?.toLowerCase().includes("jomtien") ? "Quieter Jomtien profile" : "Area quietness needs validation"
  ];
}

function familyTradeoffs(property: PropertySnapshot) {
  return [
    property.bedrooms < 2 ? "Bedroom count may be tight for family use" : "Check school and transport routine",
    property.floor && property.floor > 18 ? "High floor can be less convenient with children" : "Noise should be checked at night"
  ];
}

function formatYield(property: PropertySnapshot) {
  if (!property.monthlyRentEstimate || property.price.amount <= 0) {
    return "Pending";
  }

  return `${(((property.monthlyRentEstimate.amount * 12) / property.price.amount) * 100).toFixed(1)}%`;
}

function isQuietArea(property: PropertySnapshot) {
  const address = property.address?.toLowerCase() ?? "";

  return address.includes("jomtien") || address.includes("wongamat");
}
