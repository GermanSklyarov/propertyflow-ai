import { describe, expect, it } from "vitest";
import type { PropertySnapshot } from "@propertyflow/domain";
import { NaturalLanguagePropertySearchService } from "./natural-language-property-search.service.js";

describe("NaturalLanguagePropertySearchService", () => {
  it("extracts strict filters from Russian sea-view condo requests", () => {
    const service = new NaturalLanguagePropertySearchService({} as never, {} as never);

    const interpretation = service.interpret({
      locale: "ru",
      query: "подбери кондо в паттайе с видом на море до 3млн"
    });

    expect(interpretation.filters).toMatchObject({
      market: "pattaya",
      maxPriceThb: 3_000_000,
      requiredAmenities: ["sea-view"]
    });
    expect(interpretation.rankingExplanation).toContain("requiredAmenities=sea-view");
  });

  it("falls back to Postgres search when indexed search returns no recommendable listings", async () => {
    const property = propertyFactory({ id: "property-available", status: "available" });
    const repository = {
      findById: async () => null,
      search: async () => [property]
    };
    const indexedSearch = {
      search: async () => ({
        filters: { query: "sea view condo" },
        index: "propertyflow-properties-v1",
        items: [],
        total: 0
      })
    };
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "sea view condo in Pattaya"
    });

    expect(result.items).toEqual([property]);
    expect(result.total).toBe(1);
    expect(result.rankingExplanation).toContain("Postgres filtered search was used as a fallback");
  });

  it("does not recommend unavailable indexed listings", async () => {
    const available = propertyFactory({ id: "property-available", status: "available" });
    const sold = propertyFactory({ id: "property-sold", status: "sold" });
    const repository = {
      findById: async (_tenantId: string, propertyId: string) => propertyId === sold.id ? sold : available,
      search: async () => []
    };
    const indexedSearch = {
      search: async () => ({
        filters: { query: "wongamat condo" },
        index: "propertyflow-properties-v1",
        items: [
          { propertyId: sold.id },
          { propertyId: available.id }
        ],
        total: 2
      })
    };
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "wongamat condo"
    });

    expect(result.items.map((item) => item.id)).toEqual([available.id]);
  });
});

function propertyFactory(overrides: Partial<PropertySnapshot> = {}): PropertySnapshot {
  return {
    address: "Wongamat Beach",
    amenities: ["sea-view"],
    areaSqm: 45,
    bathrooms: 1,
    beachDistanceMeters: 300,
    bedrooms: 1,
    createdAt: "2026-07-01T00:00:00.000Z",
    description: "Sea view condo",
    id: "property-1",
    kind: "condo",
    listingType: "sale",
    location: {
      latitude: 12.95,
      longitude: 100.88
    },
    market: "pattaya",
    price: {
      amount: 3_000_000,
      currency: "THB"
    },
    status: "available",
    tenantId: "demo-agency",
    title: "Wongamat Sea View",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides
  };
}
