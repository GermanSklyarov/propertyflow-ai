import { describe, expect, it } from "vitest";
import {
  buildListingImportColumnMapping,
  listingImportTemplateColumns,
  parseListingImportHeaderRow
} from "./listing-import-mapping";

describe("listing import mapping", () => {
  it("keeps CSV import aligned with production listing source signals", () => {
    expect(listingImportTemplateColumns).toEqual(
      expect.arrayContaining([
        "availableUntil",
        "foreignQuota",
        "imageUrls",
        "maintenanceFeeMonthlyThb",
        "minimumRentalMonths",
        "projectDeveloper"
      ])
    );
  });

  it("automaps agency-specific CSV headers to canonical import columns", () => {
    const headers = parseListingImportHeaderRow(
      [
        "Listing ID",
        "Property Name",
        "City",
        "Deal Type",
        "Sale Price",
        "Monthly Rent",
        "Images",
        "Rent Available Until",
        "Minimum Stay",
        "Foreign Quota",
        "Common Fee"
      ].join(",")
    );

    expect(buildListingImportColumnMapping(listingImportTemplateColumns, headers)).toMatchObject({
      availableUntil: "Rent Available Until",
      externalId: "Listing ID",
      foreignQuota: "Foreign Quota",
      imageUrls: "Images",
      listingType: "Deal Type",
      maintenanceFeeMonthlyThb: "Common Fee",
      market: "City",
      minimumRentalMonths: "Minimum Stay",
      priceThb: "Sale Price",
      rentalPriceMonthlyThb: "Monthly Rent",
      title: "Property Name"
    });
  });
});
