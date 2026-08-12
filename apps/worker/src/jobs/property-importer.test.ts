import { describe, expect, it } from "vitest";
import { PropertyImporter, parseImportedPropertyDraftsForDiagnostics } from "./property-importer.js";

describe("property importer diagnostics", () => {
  it("maps common CSV pet policy columns to the pet-friendly amenity", () => {
    const csv = [
      "listing_id,title,deal_type,market,sale_price_thb,rent_long_term_thb_month,size_sqm,bedrooms,pets_allowed,allows_pets,pet_policy_notes",
      "pet-1,Pet Allowed Studio,rent,pattaya,0,25000,35,1,yes,,",
      "pet-2,Allows Pets Loft,rent,pattaya,0,28000,42,1,,true,",
      "pet-3,Dog Policy Condo,rent,pattaya,0,27000,40,1,,,Dogs allowed with deposit"
    ].join("\n");

    const drafts = parseImportedPropertyDraftsForDiagnostics(csv, {
      importMode: "concierge_index_only",
      source: "csv"
    });

    expect(drafts).toHaveLength(3);
    expect(drafts.map((draft) => draft.amenities)).toEqual([
      ["pet-friendly"],
      ["pet-friendly"],
      ["pet-friendly"]
    ]);
  });

  it("creates search-card records for Starter concierge-only imports without counting CRM records", async () => {
    const importer = new PropertyImporter(mockPool() as never);
    const result = await importer.import({
      data: {
        importMode: "concierge_index_only",
        objectUrl: [
          "data:text/csv,",
          encodeURIComponent(
            [
              "listing_id,title,deal_type,market,rent_long_term_thb_month,size_sqm,bedrooms,pets_allowed,status",
              "starter-pet-1,Starter Pet Studio,rent,pattaya,25000,35,1,yes,available"
            ].join("\n")
          )
        ].join(""),
        source: "csv",
        tenantId: "demo-agency"
      },
      updateProgress: async () => undefined
    } as never);

    expect(result).toMatchObject({
      crmRecordsCreated: 0,
      imported: 1,
      knowledgeDocumentsCreated: 1,
      propertyIds: ["property-1"],
      searchRecordsCreated: 1
    });
  });
});

function mockPool() {
  const client = {
    query: async (sql: string) => {
      if (sql.includes("returning id")) {
        return { rows: [{ id: "property-1" }] };
      }

      return { rows: [] };
    },
    release: () => undefined
  };

  return {
    connect: async () => client
  };
}
