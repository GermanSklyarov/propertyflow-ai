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

  it("treats compact monthly budgets as rental searches", () => {
    const service = new NaturalLanguagePropertySearchService({} as never, {} as never, {} as never);

    const interpretation = service.interpret({
      locale: "en",
      query: "find me a condo in pattaya under 30k per month"
    });

    expect(interpretation.filters).toMatchObject({
      listingType: "rent",
      market: "pattaya",
      maxMonthlyRentThb: 30_000
    });
    expect(interpretation.filters).not.toHaveProperty("maxPriceThb");
  });

  it("treats pets and dogs as a strict pet-friendly amenity requirement", () => {
    const service = new NaturalLanguagePropertySearchService({} as never, {} as never, {} as never);

    const interpretation = service.interpret({
      locale: "en",
      query: "find me a condo in pattaya under 30k/month, i am going to live with 2 dogs, so it has to be pet-friendly"
    });

    expect(interpretation.filters).toMatchObject({
      listingType: "rent",
      market: "pattaya",
      maxMonthlyRentThb: 30_000,
      requiredAmenities: ["pet-friendly"]
    });
    expect(interpretation.rankingExplanation).toContain("requiredAmenities=pet-friendly");
  });

  it("does not treat recommend as a rental intent when buy is explicit", () => {
    const service = new NaturalLanguagePropertySearchService({} as never, {} as never, {} as never);

    const interpretation = service.interpret({
      locale: "en",
      query: "i want to buy a condo in pattaya for investment under 5m, what can you recommend?"
    });

    expect(interpretation.filters).toMatchObject({
      listingType: "sale",
      market: "pattaya",
      maxPriceThb: 5_000_000
    });
    expect(interpretation.filters).not.toHaveProperty("maxMonthlyRentThb");
    expect(interpretation.purpose).toBe("investment");
  });

  it("treats million budget with children and washing machine as a family purchase search", () => {
    const service = new NaturalLanguagePropertySearchService({} as never, {} as never, {} as never);

    const interpretation = service.interpret({
      locale: "en",
      query:
        "I need an apartment in Pattaya for living with children, ideally near a school and definitely with a washing machine. What can you offer? Budget under 5m"
    });

    expect(interpretation.filters).toMatchObject({
      listingType: "sale",
      market: "pattaya",
      minBedrooms: 2,
      maxPriceThb: 5_000_000,
      requiredAmenities: ["washing machine"]
    });
    expect(interpretation.purpose).toBe("family");
    expect(interpretation.rankingPreferences.preferFamilyFit).toBe(true);
  });

  it("treats non-mandatory washing machine as a ranking preference", () => {
    const service = new NaturalLanguagePropertySearchService({} as never, {} as never, {} as never);

    const interpretation = service.interpret({
      locale: "en",
      query:
        "I need an apartment in Pattaya for living with children, ideally near a school and with a washing machine. Budget under 5m"
    });

    expect(interpretation.filters).toMatchObject({
      listingType: "sale",
      market: "pattaya",
      minBedrooms: 2,
      maxPriceThb: 5_000_000
    });
    expect(interpretation.filters.requiredAmenities ?? []).not.toContain("washing machine");
    expect(interpretation.rankingPreferences.preferWashingMachine).toBe(true);
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

  it("supplements a thin indexed shortlist with structured sale matches", async () => {
    const indexedOnly = propertyFactory({
      id: "property-wongamat",
      listingType: "sale_or_rent",
      price: { amount: 3_450_000, currency: "THB" },
      title: "Wongamat Sea View Residence"
    });
    const jomtien = propertyFactory({
      id: "property-jomtien",
      listingType: "sale",
      price: { amount: 4_850_000, currency: "THB" },
      title: "Jomtien Family Corner Condo"
    });
    const pratumnak = propertyFactory({
      id: "property-pratumnak",
      listingType: "sale",
      price: { amount: 2_950_000, currency: "THB" },
      title: "Pratumnak Investment One-Bed"
    });
    const repository = {
      findById: async () => indexedOnly,
      search: async () => [indexedOnly, jomtien, pratumnak]
    };
    const indexedSearch = {
      search: async () => ({
        filters: { query: "buy investment condo pattaya under 5m" },
        index: "propertyflow-properties-v1",
        items: [{ propertyId: indexedOnly.id }],
        total: 1
      })
    };
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never, {
      rankCandidates: async () => []
    } as never);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "i want to buy a condo in pattaya for investment under 5m, what can you recommend?"
    });

    expect(result.filters).toMatchObject({
      listingType: "sale",
      market: "pattaya",
      maxPriceThb: 5_000_000
    });
    expect(result.items.map((item) => item.title)).toEqual([
      "Wongamat Sea View Residence",
      "Jomtien Family Corner Condo",
      "Pratumnak Investment One-Bed"
    ]);
    expect(result.rankingExplanation).toContain("Postgres filtered search supplemented the indexed shortlist");
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

  it("does not recommend smoke or incomplete imported listings", async () => {
    const smoke = propertyFactory({ id: "smoke-property", title: "Smoke Beach Condo smoke-eb330e15" });
    const incomplete = propertyFactory({
      areaSqm: 1,
      id: "starter-import",
      price: { amount: 0, currency: "THB" },
      title: "Starter Import Real Listing starter-import-73d24796"
    });
    const available = propertyFactory({
      id: "property-available",
      listingType: "rent",
      rentalPriceMonthly: { amount: 24_000, currency: "THB" },
      title: "Central Pattaya Rental Loft"
    });
    const repository = {
      findById: async (_tenantId: string, propertyId: string) =>
        propertyId === smoke.id ? smoke : propertyId === incomplete.id ? incomplete : available,
      search: async () => []
    };
    const indexedSearch = {
      search: async () => ({
        filters: { query: "pattaya rental condo" },
        index: "propertyflow-properties-v1",
        items: [
          { propertyId: smoke.id },
          { propertyId: incomplete.id },
          { propertyId: available.id }
        ],
        total: 3
      })
    };
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never, {
      rankCandidates: async () => []
    } as never);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "pattaya rental condo"
    });

    expect(result.items.map((item) => item.id)).toEqual([available.id]);
  });

  it("only recommends pet-friendly listings when the visitor needs pets allowed", async () => {
    const petFriendlyIndexed = propertyFactory({
      amenities: ["pet-friendly", "pool"],
      id: "pet-friendly-indexed",
      listingType: "rent",
      rentalPriceMonthly: { amount: 28_000, currency: "THB" },
      title: "Pet Friendly Wongamat Condo"
    });
    const notPetFriendlyIndexed = propertyFactory({
      amenities: ["pool", "gym"],
      id: "not-pet-friendly-indexed",
      listingType: "rent",
      rentalPriceMonthly: { amount: 24_000, currency: "THB" },
      title: "Central Pattaya Rental Loft"
    });
    const petFriendlyFallback = propertyFactory({
      amenities: ["pet-friendly", "sea-view"],
      id: "pet-friendly-fallback",
      listingType: "rent",
      rentalPriceMonthly: { amount: 26_000, currency: "THB" },
      title: "Jomtien Pet Friendly Studio"
    });
    const byId = new Map([
      [petFriendlyIndexed.id, petFriendlyIndexed],
      [notPetFriendlyIndexed.id, notPetFriendlyIndexed],
      [petFriendlyFallback.id, petFriendlyFallback]
    ]);
    const repository = {
      findById: async (_tenantId: string, propertyId: string) => byId.get(propertyId) ?? null,
      search: async () => [petFriendlyFallback, notPetFriendlyIndexed]
    };
    const indexedSearch = {
      search: async (_tenantId: string, request: { requiredAmenities?: string[] }) => ({
        filters: request,
        index: "propertyflow-properties-v1",
        items: [
          { propertyId: petFriendlyIndexed.id },
          { propertyId: notPetFriendlyIndexed.id }
        ],
        total: 2
      })
    };
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never, {
      rankCandidates: async () => []
    } as never);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "i need a room in pattaya that is suitable for living with pets"
    });

    expect(result.filters.requiredAmenities).toEqual(["pet-friendly"]);
    expect(result.filters.lifestyleSignals).toContain("pet-friendly");
    expect(result.items.map((item) => item.id)).toEqual([petFriendlyIndexed.id, petFriendlyFallback.id]);
  });

  it("requires washing machine and reranks family search results by child-friendly fit", async () => {
    const noWasher = propertyFactory({
      amenities: ["pool", "gym", "kids playground"],
      id: "no-washer",
      listingType: "sale",
      price: { amount: 3_500_000, currency: "THB" },
      title: "Family Amenities Without Washer"
    });
    const washerCompact = propertyFactory({
      amenities: ["washing machine"],
      areaSqm: 34.6,
      bedrooms: 0,
      id: "washer-compact",
      listingType: "sale",
      price: { amount: 3_200_000, currency: "THB" },
      title: "Studio Condo at AD Hyatt Condominium"
    });
    const washerFamily = propertyFactory({
      amenities: ["washing machine", "kids playground", "garden"],
      areaSqm: 58,
      bedrooms: 2,
      id: "washer-family",
      listingType: "sale",
      price: { amount: 4_800_000, currency: "THB" },
      title: "2BR Family Condo near School"
    });
    const byId = new Map([
      [noWasher.id, noWasher],
      [washerCompact.id, washerCompact],
      [washerFamily.id, washerFamily]
    ]);
    const repository = {
      findById: async (_tenantId: string, propertyId: string) => byId.get(propertyId) ?? null,
      search: async () => [washerCompact, noWasher, washerFamily]
    };
    const indexedSearch = {
      search: async () => ({
        filters: { query: "family purchase with washing machine" },
        index: "propertyflow-properties-v1",
        items: [
          { propertyId: noWasher.id },
          { propertyId: washerCompact.id },
          { propertyId: washerFamily.id }
        ],
        total: 3
      })
    };
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never, {
      rankCandidates: async () => []
    } as never);

    const result = await service.search("demo-agency", {
      locale: "en",
      query:
        "I need an apartment in Pattaya for living with children, ideally near a school and definitely with a washing machine. Budget under 5m"
    });

    expect(result.filters).toMatchObject({
      listingType: "sale",
      market: "pattaya",
      minBedrooms: 2,
      maxPriceThb: 5_000_000,
      requiredAmenities: ["washing machine"]
    });
    expect(result.filters.lifestyleSignals).toContain("school-access");
    expect(result.items.map((item) => item.id)).toEqual(["washer-family"]);
  });

  it("keeps family listings without washer when washer is only preferred", async () => {
    const noWasherFamily = propertyFactory({
      amenities: ["kids playground", "garden"],
      areaSqm: 62,
      bedrooms: 2,
      id: "no-washer-family",
      listingType: "sale",
      price: { amount: 4_500_000, currency: "THB" },
      title: "2BR Family Condo without Washer"
    });
    const washerFamily = propertyFactory({
      amenities: ["washing machine", "kids playground"],
      areaSqm: 54,
      bedrooms: 2,
      id: "washer-family",
      listingType: "sale",
      price: { amount: 4_800_000, currency: "THB" },
      title: "2BR Family Condo with Washer"
    });
    const byId = new Map([
      [noWasherFamily.id, noWasherFamily],
      [washerFamily.id, washerFamily]
    ]);
    const repository = {
      findById: async (_tenantId: string, propertyId: string) => byId.get(propertyId) ?? null,
      search: async () => [noWasherFamily, washerFamily]
    };
    const indexedSearch = {
      search: async () => ({
        filters: { query: "family purchase with washing machine" },
        index: "propertyflow-properties-v1",
        items: [
          { propertyId: noWasherFamily.id },
          { propertyId: washerFamily.id }
        ],
        total: 2
      })
    };
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never, {
      rankCandidates: async () => []
    } as never);

    const result = await service.search("demo-agency", {
      locale: "en",
      query:
        "I need an apartment in Pattaya for living with children, ideally near a school and with a washing machine. Budget under 5m"
    });

    expect(result.filters.requiredAmenities ?? []).not.toContain("washing machine");
    expect(result.items.map((item) => item.id)).toEqual(["washer-family", "no-washer-family"]);
  });

  it("softly reranks spacious requests toward larger layouts", async () => {
    const compactNearBeach = propertyFactory({
      areaSqm: 27.3,
      amenities: ["sea-view"],
      id: "compact-near-beach",
      listingType: "rent",
      rentalPriceMonthly: { amount: 24_000, currency: "THB" },
      title: "1BR Condo at Siam Oriental Tropical Garden"
    });
    const midSize = propertyFactory({
      areaSqm: 29.8,
      amenities: ["sea-view"],
      id: "mid-size",
      listingType: "rent",
      rentalPriceMonthly: { amount: 24_000, currency: "THB" },
      title: "1BR Condo at The Cliff"
    });
    const largerSeaView = propertyFactory({
      areaSqm: 42,
      amenities: ["sea-view", "pool", "gym"],
      id: "larger-sea-view",
      listingType: "rent",
      rentalPriceMonthly: { amount: 28_000, currency: "THB" },
      title: "Wongamat Sea View Residence"
    });
    const repository = {
      findById: async () => null,
      search: async () => [compactNearBeach, midSize, largerSeaView]
    };
    const indexedSearch = {
      search: async () => ({
        filters: { query: "spacious sea view rental under 30k" },
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
      query: "I'm looking for a spacious studio in Pattaya close to the beach and with sea view for rent under 30k/month"
    });

    expect(result.filters).toMatchObject({
      listingType: "rent",
      market: "pattaya",
      maxMonthlyRentThb: 30_000,
      requiredAmenities: ["sea-view"]
    });
    expect(result.items.map((item) => item.id)).toEqual(["larger-sea-view", "mid-size", "compact-near-beach"]);
    expect(result.rankingExplanation).toContain("Spacious requests are softly reranked toward larger layouts.");
  });

  it("keeps larger layouts ahead of compact vector matches for spacious requests", async () => {
    const compactVectorFavorite = propertyFactory({
      areaSqm: 27.3,
      amenities: ["sea-view"],
      id: "compact-vector-favorite",
      listingType: "rent",
      rentalPriceMonthly: { amount: 24_000, currency: "THB" },
      title: "Compact Beach Studio"
    });
    const largerSeaView = propertyFactory({
      areaSqm: 42,
      amenities: ["sea-view"],
      id: "larger-sea-view",
      listingType: "rent",
      rentalPriceMonthly: { amount: 28_000, currency: "THB" },
      title: "Wongamat Sea View Residence"
    });
    const byId = new Map([
      [compactVectorFavorite.id, compactVectorFavorite],
      [largerSeaView.id, largerSeaView]
    ]);
    const repository = {
      findById: async (_tenantId: string, propertyId: string) => byId.get(propertyId) ?? null,
      search: async () => []
    };
    const indexedSearch = {
      search: async () => ({
        filters: { query: "spacious sea view rental under 30k" },
        index: "propertyflow-properties-v1",
        items: [
          { propertyId: compactVectorFavorite.id },
          { propertyId: largerSeaView.id }
        ],
        total: 2
      })
    };
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never, {
      rankCandidates: async () => [
        { propertyId: compactVectorFavorite.id, rank: 1, similarityScore: 0.99 },
        { propertyId: largerSeaView.id, rank: 2, similarityScore: 0.4 }
      ]
    } as never);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "I'm looking for a spacious studio in Pattaya close to the beach and with sea view for rent under 30k/month"
    });

    expect(result.items.map((item) => item.id)).toEqual(["larger-sea-view", "compact-vector-favorite"]);
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
