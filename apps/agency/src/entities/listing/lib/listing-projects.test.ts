import { describe, expect, it } from "vitest";
import type { PropertySnapshot } from "@propertyflow/domain";
import { buildListingProjectCoverage } from "./listing-projects";

const baseListing = {
  address: "Wongamat Beach",
  amenities: [],
  areaSqm: 45,
  bathrooms: 1,
  beachDistanceMeters: 300,
  bedrooms: 1,
  createdAt: "2026-07-14T00:00:00.000Z",
  id: "listing-1",
  kind: "condo",
  listingType: "sale",
  location: { latitude: 12.9, longitude: 100.88 },
  market: "pattaya",
  price: { amount: 3_500_000, currency: "THB" },
  status: "available",
  tenantId: "demo-agency",
  title: "Wongamat condo",
  updatedAt: "2026-07-14T00:00:00.000Z"
} satisfies PropertySnapshot;

describe("listing project coverage", () => {
  it("groups listings by project and counts mixed listing types", () => {
    const summary = buildListingProjectCoverage([
      {
        ...baseListing,
        id: "listing-1",
        listingType: "sale_or_rent",
        project: {
          amenities: [],
          createdAt: "2026-07-14T00:00:00.000Z",
          id: "project-1",
          market: "pattaya",
          name: "The Riviera Wongamat",
          status: "completed",
          tenantId: "demo-agency",
          updatedAt: "2026-07-14T00:00:00.000Z"
        }
      },
      {
        ...baseListing,
        id: "listing-2",
        listingType: "rent",
        project: {
          amenities: [],
          createdAt: "2026-07-14T00:00:00.000Z",
          id: "project-1",
          market: "pattaya",
          name: "The Riviera Wongamat",
          status: "completed",
          tenantId: "demo-agency",
          updatedAt: "2026-07-14T00:00:00.000Z"
        }
      },
      {
        ...baseListing,
        id: "listing-3",
        project: undefined
      }
    ]);

    expect(summary.linkedListings).toBe(2);
    expect(summary.missingProjectListings).toBe(1);
    expect(summary.projects).toEqual([
      expect.objectContaining({
        id: "project-1",
        listingCount: 2,
        rentCount: 2,
        saleCount: 1
      })
    ]);
    expect(summary.statusCounts).toEqual([{ count: 2, label: "completed" }]);
  });
});
