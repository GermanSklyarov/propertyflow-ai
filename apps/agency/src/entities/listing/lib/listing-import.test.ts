import { describe, expect, it } from "vitest";
import { buildCreatePropertyRequest, parseListingImportCsv } from "./listing-import";

describe("listing CSV import", () => {
  it("parses CSV rows and builds create property payloads", () => {
    const result = parseListingImportCsv(
      [
        "title,market,kind,listingType,priceThb,rentalPriceMonthlyThb,areaSqm,bedrooms,bathrooms,address,amenities,description",
        '"Wongamat Sea View",pattaya,condo,sale_or_rent,3500000,24000,45,1,1,"Wongamat Beach","pool|gym|sea view","Near beach"'
      ].join("\n")
    );

    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(buildCreatePropertyRequest(result.rows[0])).toMatchObject({
      address: "Wongamat Beach",
      amenities: ["pool", "gym", "sea view"],
      areaSqm: 45,
      bathrooms: 1,
      bedrooms: 1,
      description: "Near beach",
      kind: "condo",
      listingType: "sale_or_rent",
      market: "pattaya",
      price: { amount: 3500000, currency: "THB" },
      rentalPriceMonthly: { amount: 24000, currency: "THB" },
      title: "Wongamat Sea View"
    });
  });

  it("skips rows without a title and reports the source row number", () => {
    const result = parseListingImportCsv(["title,market,priceThb", ",pattaya,3500000"].join("\n"));

    expect(result.rows).toEqual([]);
    expect(result.issues).toEqual([{ rowNumber: 2, reason: "Missing title" }]);
  });
});
