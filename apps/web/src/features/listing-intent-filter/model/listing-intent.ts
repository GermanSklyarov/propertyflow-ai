import type { PropertyListingType, PropertySnapshot } from "@propertyflow/domain";

export type ListingIntent = "all" | PropertyListingType;
export type RentalBudgetBand = {
  max: number;
  min: number;
};

export function parseListingIntent(value: string | string[] | null | undefined): ListingIntent {
  const intent = Array.isArray(value) ? value[0] : value;

  if (intent === "sale" || intent === "rent" || intent === "sale_or_rent") {
    return intent;
  }

  return "all";
}

export function filterPropertiesByIntent(properties: PropertySnapshot[], intent: ListingIntent) {
  if (intent === "all") {
    return properties;
  }

  if (intent === "rent") {
    return properties.filter((property) => property.listingType === "rent" || property.listingType === "sale_or_rent");
  }

  if (intent === "sale") {
    return properties.filter((property) => property.listingType === "sale" || property.listingType === "sale_or_rent");
  }

  return properties.filter((property) => property.listingType === intent);
}

export function countPropertiesByIntent(properties: PropertySnapshot[], intent: ListingIntent) {
  return filterPropertiesByIntent(properties, intent).length;
}

export function getRentalBudgetBand(properties: PropertySnapshot[]): RentalBudgetBand | undefined {
  const rentalPrices = properties
    .map((property) => property.rentalPriceMonthly?.amount)
    .filter((amount): amount is number => typeof amount === "number");

  if (!rentalPrices.length) {
    return undefined;
  }

  return {
    max: Math.max(...rentalPrices),
    min: Math.min(...rentalPrices)
  };
}

export function listingIntentCopy(intent: ListingIntent) {
  if (intent === "rent") {
    return "Rental mode highlights monthly ask, flexible move-in thinking, and lease-first conversations.";
  }

  if (intent === "sale") {
    return "Buy mode prioritizes acquisition price, resale liquidity, and ownership economics.";
  }

  if (intent === "sale_or_rent") {
    return "Dual listings are useful when an owner is open to either sale or lease strategy.";
  }

  return "Switch between purchase and rental intent without losing the AI-picked property context.";
}
