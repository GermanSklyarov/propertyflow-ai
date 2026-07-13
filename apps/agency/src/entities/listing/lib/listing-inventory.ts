import type { PropertySnapshot } from "@propertyflow/domain";

export function buildListingInventorySummary(listings: PropertySnapshot[]) {
  const yields = listings.map(getListingGrossYield).filter((value): value is number => value !== undefined);

  return {
    aiReady: listings.filter((listing) => buildListingQueueSignal(listing).score >= 4).length,
    available: listings.filter((listing) => listing.status === "available").length,
    averageYield: yields.reduce((sum, value) => sum + value, 0) / Math.max(1, yields.length),
    byListingType: countBy(listings, (listing) => listing.listingType),
    byMarket: countBy(listings, (listing) => listing.market),
    byStatus: countBy(listings, (listing) => listing.status),
    rentalReady: listings.filter((listing) => listing.rentalPriceMonthly).length
  };
}

export function buildListingQueueSignal(listing: PropertySnapshot) {
  const checks = [
    Boolean(listing.description),
    listing.amenities.length >= 4,
    Boolean(listing.beachDistanceMeters),
    Boolean(listing.monthlyRentEstimate || listing.rentalPriceMonthly),
    Boolean(listing.maintenanceFeeMonthly)
  ];
  const score = checks.filter(Boolean).length;

  if (score >= 4) {
    return { nextAction: "publish-ready", score, tone: "good" as const };
  }

  if (!listing.description) {
    return { nextAction: "generate copy", score, tone: "warning" as const };
  }

  if (listing.amenities.length < 4) {
    return { nextAction: "add amenities", score, tone: "warning" as const };
  }

  return { nextAction: "enrich economics", score, tone: "neutral" as const };
}

export function getListingGrossYield(listing: PropertySnapshot) {
  const rent = listing.monthlyRentEstimate ?? listing.rentalPriceMonthly;

  if (!rent || listing.price.amount <= 0) {
    return undefined;
  }

  return (rent.amount * 12) / listing.price.amount;
}

function countBy<T>(items: T[], getLabel: (item: T) => string) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const label = getLabel(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}
