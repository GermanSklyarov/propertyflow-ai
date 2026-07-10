import type { PropertyListingType } from "@propertyflow/domain";

export type ListingIntent = "all" | PropertyListingType;

export function parseListingIntent(value: string | string[] | null | undefined): ListingIntent {
  const intent = Array.isArray(value) ? value[0] : value;

  if (intent === "sale" || intent === "rent" || intent === "sale_or_rent") {
    return intent;
  }

  return "all";
}
