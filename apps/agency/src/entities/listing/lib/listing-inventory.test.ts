import { describe, expect, it } from "vitest";
import type { PropertySnapshot } from "@propertyflow/domain";
import { buildListingInventorySummary } from "./listing-inventory";

const baseListing = {
  address: "Pattaya",
  amenities: ["pool"],
  areaSqm: 42,
  bathrooms: 1,
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
  title: "Pattaya condo",
  updatedAt: "2026-07-14T00:00:00.000Z"
} satisfies PropertySnapshot;

describe("listing inventory summary", () => {
  it("counts project link coverage", () => {
    const summary = buildListingInventorySummary([
      {
        ...baseListing,
        id: "listing-1",
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
        project: undefined
      }
    ]);

    expect(summary.missingProject).toBe(1);
    expect(summary.byProjectLink).toEqual([
      { count: 1, label: "linked" },
      { count: 1, label: "missing" }
    ]);
  });
});
