import { describe, expect, it } from "vitest";
import type { PropertySnapshot } from "@propertyflow/domain";
import { NaturalLanguagePropertySearchService } from "./natural-language-property-search.service.js";

describe("NaturalLanguagePropertySearchService", () => {
  it("extracts strict filters from Russian sea-view condo requests", () => {
    const service = new NaturalLanguagePropertySearchService({} as never, {} as never, {} as never);

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

  it("extracts Thai rental filters and lifestyle signals", async () => {
    const property = propertyFactory({ listingType: "rent", market: "phuket", rentalPriceMonthly: { amount: 40_000, currency: "THB" } });
    const repository = {
      findById: async () => null,
      search: async () => [property]
    };
    const indexedSearch = {
      search: async () => ({
        filters: { query: "คอนโดให้เช่าภูเก็ต 2 ห้องนอน งบไม่เกิน 40000 บาทต่อเดือน ใกล้ทะเล มีสระว่ายน้ำ ฟิตเนส เน็ตแรง" },
        index: "propertyflow-properties-v1",
        items: [],
        total: 0
      })
    };
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never, {
      rankCandidates: async () => []
    } as never);

    const result = await service.search("demo-agency", {
      locale: "th",
      query: "คอนโดให้เช่าภูเก็ต 2 ห้องนอน งบไม่เกิน 40000 บาทต่อเดือน ใกล้ทะเล มีสระว่ายน้ำ ฟิตเนส เน็ตแรง"
    });

    expect(result.filters).toMatchObject({
      listingType: "rent",
      market: "phuket",
      maxMonthlyRentThb: 40_000,
      minBedrooms: 2,
      maxBeachDistanceMeters: 1000,
      requiredAmenities: ["pool", "gym", "fast-internet"]
    });
    expect(result.filters.lifestyleSignals).toEqual(expect.arrayContaining(["beach-life", "remote-work"]));
  });

  it("extracts Chinese sale and investment filters", () => {
    const service = new NaturalLanguagePropertySearchService({} as never, {} as never, {} as never);

    const interpretation = service.interpret({
      locale: "zh",
      query: "想在芭提雅购买海景公寓，预算不超过300万泰铢，2卧室，靠近海边，有泳池，适合投资出租收益"
    });

    expect(interpretation.filters).toMatchObject({
      listingType: "sale",
      market: "pattaya",
      maxPriceThb: 3_000_000,
      minBedrooms: 2,
      maxBeachDistanceMeters: 1000,
      requiredAmenities: ["pool", "sea-view"]
    });
    expect(interpretation.purpose).toBe("investment");
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
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never, {
      rankCandidates: async () => []
    } as never);

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
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never, {
      rankCandidates: async () => []
    } as never);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "wongamat condo"
    });

    expect(result.items.map((item) => item.id)).toEqual([available.id]);
  });

  it("uses pgvector similarity to rerank recommendable indexed listings", async () => {
    const weakLexicalFirst = propertyFactory({ id: "11111111-1111-1111-1111-111111111111", title: "Generic City Condo" });
    const semanticBest = propertyFactory({ id: "22222222-2222-2222-2222-222222222222", title: "Beachfront Sea View Condo" });
    const repository = {
      findById: async (_tenantId: string, propertyId: string) =>
        propertyId === weakLexicalFirst.id ? weakLexicalFirst : semanticBest,
      search: async () => []
    };
    const indexedSearch = {
      search: async () => ({
        filters: { query: "sea view near beach" },
        index: "propertyflow-properties-v1",
        items: [
          { propertyId: weakLexicalFirst.id },
          { propertyId: semanticBest.id }
        ],
        total: 2
      })
    };
    const vectorSearch = {
      rankCandidates: async () => [
        { propertyId: semanticBest.id, rank: 1, similarityScore: 0.95 },
        { propertyId: weakLexicalFirst.id, rank: 2, similarityScore: 0.2 }
      ]
    };
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never, vectorSearch as never);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "sea view near beach"
    });

    expect(result.items.map((item) => item.id)).toEqual([semanticBest.id, weakLexicalFirst.id]);
    expect(result.rankingExplanation).toContain("pgvector semantic similarity reranked");
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
