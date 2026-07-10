import type { PropertySnapshot } from "@propertyflow/domain";
import { formatCompactThb } from "@shared/lib/format-money";

export type PropertyBrief = {
  annualRentSignal?: number;
  beachScore: number;
  grossYield?: number;
  listingLabel: string;
  primaryPrice: string;
  pros: string[];
  questions: string[];
  quietLivingScore: number;
  remoteWorkScore: number;
  summaryTitle: string;
  tradeoffs: string[];
};

export function buildPropertyBrief(property: PropertySnapshot): PropertyBrief {
  return {
    annualRentSignal: getAnnualRentSignal(property),
    beachScore: getBeachScore(property),
    grossYield: getGrossYield(property),
    listingLabel: getListingLabel(property.listingType),
    primaryPrice: getPrimaryPrice(property),
    pros: getPropertyPros(property),
    questions: getAgentQuestions(property),
    quietLivingScore: getQuietLivingScore(property),
    remoteWorkScore: getRemoteWorkScore(property),
    summaryTitle: getSummaryTitle(property),
    tradeoffs: getPropertyTradeoffs(property)
  };
}

export function getPrimaryPrice(property: PropertySnapshot) {
  if (property.listingType === "rent" && property.rentalPriceMonthly) {
    return `${formatCompactThb(property.rentalPriceMonthly.amount)}/mo`;
  }

  if (property.listingType === "sale_or_rent" && property.rentalPriceMonthly) {
    return `${formatCompactThb(property.price.amount)} or ${formatCompactThb(property.rentalPriceMonthly.amount)}/mo`;
  }

  return formatCompactThb(property.price.amount);
}

export function getListingLabel(listingType: PropertySnapshot["listingType"]) {
  if (listingType === "sale_or_rent") {
    return "Sale or rent";
  }

  return listingType === "rent" ? "For rent" : "For sale";
}

export function getGrossYield(property: PropertySnapshot) {
  if (!property.monthlyRentEstimate || property.price.amount <= 0) {
    return undefined;
  }

  return ((property.monthlyRentEstimate.amount * 12) / property.price.amount) * 100;
}

export function getAnnualRentSignal(property: PropertySnapshot) {
  return property.monthlyRentEstimate ? property.monthlyRentEstimate.amount * 12 : undefined;
}

export function getSummaryTitle(property: PropertySnapshot) {
  if (property.listingType === "rent") {
    return "Strong short-stay base with simple monthly economics.";
  }

  if (property.listingType === "sale_or_rent") {
    return "Flexible asset: usable for winter living, rent, or resale.";
  }

  return "Ownership case with rental-demand upside.";
}

export function getPropertyPros(property: PropertySnapshot) {
  return [
    property.beachDistanceMeters && property.beachDistanceMeters <= 600
      ? "Beach access is comfortably walkable."
      : "Area fit can work with local transport.",
    property.monthlyRentEstimate ? "Rental demand signal is available for ROI checks." : "Useful baseline for lifestyle search.",
    property.amenities.slice(0, 2).join(" and ") || "Core property facts are ready for agent review."
  ];
}

export function getPropertyTradeoffs(property: PropertySnapshot) {
  return [
    property.floor && property.floor > 18 ? "High floor should be checked for heat and lift wait times." : "View and street noise need on-site validation.",
    property.maintenanceFeeMonthly ? "Maintenance fee should be included in net yield." : "Maintenance fee is not confirmed yet.",
    property.listingType === "rent" ? "Lease terms, deposit, and utility policy still need confirmation." : "Final ownership costs depend on transfer and legal checks."
  ];
}

export function getBeachScore(property: PropertySnapshot) {
  if (!property.beachDistanceMeters) {
    return 3;
  }

  if (property.beachDistanceMeters <= 400) {
    return 5;
  }

  if (property.beachDistanceMeters <= 900) {
    return 4;
  }

  return 3;
}

export function getRemoteWorkScore(property: PropertySnapshot) {
  return property.amenities.some((amenity) => amenity.includes("internet")) ? 5 : 3;
}

export function getQuietLivingScore(property: PropertySnapshot) {
  return property.address?.toLowerCase().includes("jomtien") ? 5 : 4;
}

export function getAgentQuestions(property: PropertySnapshot) {
  return [
    property.listingType === "rent" ? "What lease length and deposit are acceptable?" : "What transfer fees and sinking fund apply?",
    "Can the agent confirm noise level at night?",
    "Are internet speed and building maintenance documents available?"
  ];
}
