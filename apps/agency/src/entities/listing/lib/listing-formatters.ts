import type { PropertySnapshot } from "@propertyflow/domain";

export function formatListingDistance(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value} m`;
}

export function formatListingType(value: PropertySnapshot["listingType"]) {
  const labels = {
    rent: "For rent",
    sale: "For sale",
    sale_or_rent: "Sale or rent"
  } satisfies Record<PropertySnapshot["listingType"], string>;

  return labels[value];
}

export function formatListingMoney(value: PropertySnapshot["price"]) {
  return new Intl.NumberFormat("en", {
    currency: value.currency,
    maximumFractionDigits: 0,
    notation: value.amount >= 1_000_000 ? "compact" : "standard",
    style: "currency"
  }).format(value.amount);
}

export function formatCompactListingMoney(value: PropertySnapshot["price"]) {
  return new Intl.NumberFormat("en", {
    currency: value.currency,
    maximumFractionDigits: value.amount >= 1_000_000 ? 1 : 0,
    notation: "compact",
    style: "currency"
  }).format(value.amount);
}
