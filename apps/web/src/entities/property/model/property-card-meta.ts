import type { PropertySnapshot } from "@propertyflow/domain";
import { formatCompactThb } from "@shared/lib/format-money";
import { getGrossYield } from "./property-brief";

export type PropertyCardMeta = {
  amenityLabel: string;
  listingBadge: string;
  matchSignal: string;
  priceLabel: string;
  yieldLabel: string;
};

export function buildPropertyCardMeta(property: PropertySnapshot): PropertyCardMeta {
  return {
    amenityLabel: getAmenityLabel(property),
    listingBadge: getListingBadge(property),
    matchSignal: getMatchSignal(property),
    priceLabel: getCardPriceLabel(property),
    yieldLabel: getYieldLabel(property)
  };
}

export function getCardPriceLabel(property: PropertySnapshot) {
  if (property.listingType === "rent" && property.rentalPriceMonthly) {
    return `${formatCompactThb(property.rentalPriceMonthly.amount)}/mo`;
  }

  if (property.listingType === "sale_or_rent" && property.rentalPriceMonthly) {
    return `${formatCompactThb(property.price.amount)} · ${formatCompactThb(property.rentalPriceMonthly.amount)}/mo`;
  }

  return formatCompactThb(property.price.amount);
}

export function getListingBadge(property: PropertySnapshot) {
  const listingType = property.listingType === "sale_or_rent" ? "sale/rent" : property.listingType;

  return `${listingType} · ${property.market}`;
}

export function getYieldLabel(property: PropertySnapshot) {
  const grossYield = getGrossYield(property);

  return grossYield ? `${grossYield.toFixed(1)}% gross yield` : "Yield pending";
}

export function getAmenityLabel(property: PropertySnapshot) {
  return property.amenities.slice(0, 2).join(" / ") || "Amenities pending";
}

export function getMatchSignal(property: PropertySnapshot) {
  if (property.listingType === "rent") {
    return "Lease-ready monthly case";
  }

  if (property.listingType === "sale_or_rent") {
    return "Flexible buy-or-rent strategy";
  }

  if (property.bedrooms >= 2) {
    return "Lifestyle-first ownership fit";
  }

  return "Ownership-led resale case";
}
