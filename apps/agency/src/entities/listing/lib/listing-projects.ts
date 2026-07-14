import type { PropertySnapshot } from "@propertyflow/domain";

export interface ListingProjectCoverageItem {
  id: string;
  name: string;
  market: PropertySnapshot["market"];
  status: NonNullable<PropertySnapshot["project"]>["status"];
  developer?: string;
  listingCount: number;
  saleCount: number;
  rentCount: number;
}

export interface ListingProjectCoverageSummary {
  linkedListings: number;
  missingProjectListings: number;
  projects: ListingProjectCoverageItem[];
  statusCounts: Array<{
    label: NonNullable<PropertySnapshot["project"]>["status"];
    count: number;
  }>;
}

export function buildListingProjectCoverage(listings: PropertySnapshot[]): ListingProjectCoverageSummary {
  const projects = new Map<string, ListingProjectCoverageItem>();
  const statusCounts = new Map<NonNullable<PropertySnapshot["project"]>["status"], number>();
  let linkedListings = 0;

  for (const listing of listings) {
    if (!listing.project) {
      continue;
    }

    linkedListings += 1;
    statusCounts.set(listing.project.status, (statusCounts.get(listing.project.status) ?? 0) + 1);

    const existing = projects.get(listing.project.id);
    const item =
      existing ??
      ({
        id: listing.project.id,
        name: listing.project.name,
        market: listing.project.market,
        status: listing.project.status,
        developer: listing.project.developer,
        listingCount: 0,
        rentCount: 0,
        saleCount: 0
      } satisfies ListingProjectCoverageItem);

    item.listingCount += 1;

    if (listing.listingType === "rent") {
      item.rentCount += 1;
    } else if (listing.listingType === "sale") {
      item.saleCount += 1;
    } else {
      item.rentCount += 1;
      item.saleCount += 1;
    }

    projects.set(listing.project.id, item);
  }

  return {
    linkedListings,
    missingProjectListings: listings.length - linkedListings,
    projects: [...projects.values()].sort((left, right) => right.listingCount - left.listingCount || left.name.localeCompare(right.name)),
    statusCounts: [...statusCounts.entries()]
      .map(([label, count]) => ({ count, label }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
  };
}
