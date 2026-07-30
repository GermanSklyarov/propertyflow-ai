import type { ListingSourceSnapshot } from "@propertyflow/contracts";
import { describe, expect, it } from "vitest";
import { buildListingSourceSummary } from "./listing-source-summary";

describe("buildListingSourceSummary", () => {
  it("summarizes mapped canonical and custom availability signals", () => {
    const summary = buildListingSourceSummary(listingSource());

    expect(summary).toMatchObject({
      availabilitySignals: ["Available until", "Minimum rental term", "Rent available until"],
      canonicalCount: 8,
      customAttributeCount: 2,
      readinessLabel: "Concierge-ready",
      searchableCustomAttributeCount: 2,
      syncLabel: "Last sync Jul 30, 12:10 PM"
    });
    expect(summary.missingProductionFields).toEqual([]);
  });

  it("reports production gaps that would weaken Concierge answers", () => {
    const summary = buildListingSourceSummary(
      listingSource({
        mapping: {
          canonical: {
            market: "city",
            title: "name"
          },
          customAttributes: []
        },
        status: "draft"
      })
    );

    expect(summary.readinessLabel).toBe("4 production gaps");
    expect(summary.missingProductionFields).toEqual(["Sale/rent", "Status", "Sale or rent price", "Availability or lease term"]);
  });

  it("prioritizes failed sync status over mapping completeness", () => {
    const summary = buildListingSourceSummary(listingSource({ status: "failed" }));

    expect(summary.readinessLabel).toBe("Fix sync before production");
  });
});

function listingSource(overrides: Partial<ListingSourceSnapshot> = {}): ListingSourceSnapshot {
  return {
    authType: "api-key-header",
    createdAt: "2026-07-30T00:00:00.000Z",
    endpointUrl: "https://agency.example.com/api/listings",
    id: "listing-source-1",
    importMode: "concierge_index_only",
    lastSyncAt: "2026-07-30T12:10:00.000Z",
    mapping: {
      canonical: {
        availableUntil: "rent_available_until",
        externalId: "id",
        listingType: "deal_type",
        market: "city",
        minimumRentalMonths: "minimum_rental_months",
        rentalPriceMonthlyAmount: "monthly_rent",
        status: "status",
        title: "name"
      },
      customAttributes: [
        {
          filterHint: "availability",
          key: "lease_available_until",
          label: "Rent available until",
          searchable: true,
          sourcePath: "rent_available_until",
          type: "date"
        },
        {
          filterHint: "view",
          key: "view_quality",
          label: "View quality",
          searchable: true,
          sourcePath: "view_note",
          type: "text"
        }
      ],
      rawPayloadMode: "store_selected"
    },
    name: "Partner API",
    status: "connected",
    tenantId: "demo-agency",
    type: "rest-api",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides
  };
}
