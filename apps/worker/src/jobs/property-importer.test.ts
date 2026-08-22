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
    const pool = mockPool();
    const importer = new PropertyImporter(pool as never);
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
      knowledgeDocumentsCreated: 0,
      propertyIds: ["property-1"],
      searchRecordsCreated: 1
    });
    expect(pool.queries.some((query) => query.sql.includes("insert into knowledge_documents"))).toBe(false);
  });

  it("imports Starter REST listing sources as concierge search records instead of articles", async () => {
    const pool = mockPool();
    const importer = new PropertyImporter(pool as never);
    const result = await importer.import({
      data: {
        fieldMapping: partnerFieldMapping(),
        importMode: "concierge_index_only",
        objectUrl: [
          "data:application/json,",
          encodeURIComponent(JSON.stringify({
            listings: [
              {
                id: "rest-1",
                name: "REST Starter Rental Studio",
                deal: "rent",
                city: "pattaya",
                monthlyRent: 18000,
                size: 32,
                beds: 0,
                state: "available"
              }
            ]
          }))
        ].join(""),
        source: "partner-api",
        tenantId: "demo-agency"
      },
      updateProgress: async () => undefined
    } as never);

    expect(result).toMatchObject({
      crmRecordsCreated: 0,
      imported: 1,
      knowledgeDocumentsCreated: 0,
      propertyIds: ["property-1"],
      searchRecordsCreated: 1,
      source: "partner-api"
    });
    expect(pool.queries.some((query) => query.sql.includes("insert into properties"))).toBe(true);
    expect(pool.queries.some((query) => query.sql.includes("insert into knowledge_documents"))).toBe(false);
  });

  it("imports Starter XML listing sources as concierge search records instead of articles", async () => {
    const pool = mockPool();
    const importer = new PropertyImporter(pool as never);
    const xml = [
      "<response>",
      "  <listing>",
      "    <id>xml-1</id>",
      "    <name>XML Starter Condo</name>",
      "    <deal>sale</deal>",
      "    <city>pattaya</city>",
      "    <price>4200000</price>",
      "    <size>41</size>",
      "    <beds>1</beds>",
      "    <state>available</state>",
      "  </listing>",
      "</response>"
    ].join("");

    const result = await importer.import({
      data: {
        fieldMapping: partnerFieldMapping("response.listing"),
        importMode: "concierge_index_only",
        objectUrl: `data:application/xml,${encodeURIComponent(xml)}`,
        source: "partner-xml",
        tenantId: "demo-agency"
      },
      updateProgress: async () => undefined
    } as never);

    expect(result).toMatchObject({
      crmRecordsCreated: 0,
      imported: 1,
      knowledgeDocumentsCreated: 0,
      propertyIds: ["property-1"],
      searchRecordsCreated: 1,
      source: "partner-xml"
    });
    expect(pool.queries.some((query) => query.sql.includes("insert into properties"))).toBe(true);
    expect(pool.queries.some((query) => query.sql.includes("insert into knowledge_documents"))).toBe(false);
  });

  it("keeps Starter REST auto-refresh imports indexable by upserting the same external listing", async () => {
    const pool = mockPool();
    const importer = new PropertyImporter(pool as never);
    const job = {
      data: {
        fieldMapping: partnerFieldMapping(),
        importMode: "concierge_index_only",
        objectUrl: [
          "data:application/json,",
          encodeURIComponent(JSON.stringify({
            listings: [
              {
                id: "refresh-1",
                name: "Refreshable Starter Condo",
                deal: "rent",
                city: "pattaya",
                monthlyRent: 22000,
                size: 38,
                beds: 1,
                state: "available"
              }
            ]
          }))
        ].join(""),
        source: "partner-api",
        sourceConfigId: "source-1",
        tenantId: "demo-agency"
      },
      updateProgress: async () => undefined
    } as never;

    const firstResult = await importer.import(job);
    const refreshResult = await importer.import(job);

    expect(firstResult).toMatchObject({
      knowledgeDocumentsCreated: 0,
      propertyIds: ["property-1"],
      searchRecordsCreated: 1
    });
    expect(refreshResult).toMatchObject({
      knowledgeDocumentsCreated: 0,
      propertyIds: ["property-1"],
      searchRecordsCreated: 1
    });
    expect(pool.externalIds.get("refresh-1")).toBe("property-1");
  });

  it("imports structured short-term rent and minimum rental term from partner mappings", async () => {
    const pool = mockPool();
    const importer = new PropertyImporter(pool as never);

    await importer.import({
      data: {
        fieldMapping: {
          canonical: {
            ...partnerFieldMapping().canonical,
            minimumRentalMonths: "minMonths",
            shortTermRentalPriceMonthlyAmount: "shortRent"
          }
        },
        importMode: "concierge_index_only",
        objectUrl: [
          "data:application/json,",
          encodeURIComponent(JSON.stringify({
            listings: [
              {
                id: "short-1",
                name: "Short Stay Starter Condo",
                deal: "rent",
                city: "pattaya",
                monthlyRent: 24000,
                shortRent: 32000,
                minMonths: 1,
                size: 38,
                beds: 1,
                state: "available"
              }
            ]
          }))
        ].join(""),
        source: "partner-api",
        tenantId: "demo-agency"
      },
      updateProgress: async () => undefined
    } as never);

    const propertyInsert = pool.queries.find((query) => query.sql.includes("insert into properties"));

    expect(propertyInsert?.sql).toContain("short_term_rental_price_monthly_amount");
    expect(propertyInsert?.values?.[10]).toBe(24_000);
    expect(propertyInsert?.values?.[11]).toBe(32_000);
    expect(propertyInsert?.values?.[12]).toBe(1);
  });
});

function mockPool() {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const externalIds = new Map<string, string>();

  const client = {
    query: async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values });
      if (sql.includes("returning id")) {
        const externalId = typeof values?.[3] === "string" ? values[3] : undefined;
        const id = externalId ? externalIds.get(externalId) ?? `property-${externalIds.size + 1}` : `property-${externalIds.size + 1}`;

        if (externalId) {
          externalIds.set(externalId, id);
        }

        return { rows: [{ id }] };
      }

      return { rows: [] };
    },
    release: () => undefined
  };

  return {
    connect: async () => client,
    externalIds,
    queries
  };
}

function partnerFieldMapping(rootPath?: string) {
  return {
    rootPath,
    canonical: {
      areaSqm: "size",
      bedrooms: "beds",
      externalId: "id",
      listingType: "deal",
      market: "city",
      priceAmount: "price",
      rentalPriceMonthlyAmount: "monthlyRent",
      status: "state",
      title: "name"
    }
  };
}
