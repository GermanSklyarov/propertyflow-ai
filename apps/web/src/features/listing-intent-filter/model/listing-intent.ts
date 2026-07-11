import type { PropertyListingType, PropertySnapshot } from "@propertyflow/domain";

export type ListingIntent = "all" | PropertyListingType;
export type ListingSort = "ai-fit" | "price-asc" | "yield-desc" | "beach-asc";
export type RentalBudgetBand = {
  max: number;
  min: number;
};
export type ListingIntentSummary = {
  label: string;
  max?: number;
  min?: number;
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

export function sortPropertiesForCatalog(properties: PropertySnapshot[], sort: ListingSort) {
  return [...properties].sort((left, right) => {
    if (sort === "price-asc") {
      return getPrimaryPrice(left) - getPrimaryPrice(right);
    }

    if (sort === "yield-desc") {
      return getGrossYield(right) - getGrossYield(left);
    }

    if (sort === "beach-asc") {
      return getBeachDistance(left) - getBeachDistance(right);
    }

    return getCatalogFitScore(right) - getCatalogFitScore(left);
  });
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

export function getPurchaseBudgetBand(properties: PropertySnapshot[]): RentalBudgetBand | undefined {
  const prices = properties
    .map((property) => property.price.amount)
    .filter((amount): amount is number => typeof amount === "number" && amount > 0);

  if (!prices.length) {
    return undefined;
  }

  return {
    max: Math.max(...prices),
    min: Math.min(...prices)
  };
}

export function getListingIntentSummary(properties: PropertySnapshot[], intent: ListingIntent): ListingIntentSummary {
  const filteredProperties = filterPropertiesByIntent(properties, intent);

  if (intent === "rent") {
    return {
      ...getRentalBudgetBand(filteredProperties),
      label: "monthly rental band"
    };
  }

  if (intent === "sale") {
    return {
      ...getPurchaseBudgetBand(filteredProperties),
      label: "purchase band"
    };
  }

  if (intent === "sale_or_rent") {
    return {
      ...getRentalBudgetBand(filteredProperties),
      label: "dual-listing rent band"
    };
  }

  return {
    ...getPurchaseBudgetBand(filteredProperties),
    label: "market purchase band"
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

function getPrimaryPrice(property: PropertySnapshot) {
  return property.listingType === "rent" && property.rentalPriceMonthly
    ? property.rentalPriceMonthly.amount
    : property.price.amount;
}

function getGrossYield(property: PropertySnapshot) {
  if (!property.monthlyRentEstimate?.amount || !property.price.amount) {
    return 0;
  }

  return (property.monthlyRentEstimate.amount * 12) / property.price.amount;
}

function getBeachDistance(property: PropertySnapshot) {
  return property.beachDistanceMeters ?? Number.MAX_SAFE_INTEGER;
}

function getCatalogFitScore(property: PropertySnapshot) {
  let score = property.status === "available" ? 40 : 10;

  if (property.beachDistanceMeters !== undefined) {
    score += Math.max(0, 25 - property.beachDistanceMeters / 100);
  }

  if (property.amenities.some((amenity) => amenity.includes("fiber") || amenity.includes("coworking"))) {
    score += 12;
  }

  if (property.amenities.some((amenity) => amenity.includes("sea-view") || amenity.includes("beachfront"))) {
    score += 10;
  }

  score += Math.min(18, getGrossYield(property) * 200);

  return score;
}
