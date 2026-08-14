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

  it("does not treat Russian words like увидеть as a family-with-children request", () => {
    const service = new NaturalLanguagePropertySearchService({} as never, {} as never, {} as never);

    const interpretation = service.interpret({
      locale: "ru",
      query: "хочу на зимовку в паттайю и иногда увидеть снег, подбери квартиру недалеко от Frost Magical Ice of Siam"
    });

    expect(interpretation.purpose).toBe("living");
    expect(interpretation.filters).not.toHaveProperty("minBedrooms");
    expect(interpretation.rankingExplanation).not.toContain("family fit");
  });

  it("does not treat Russian seven-day move-in timing as a family request", () => {
    const service = new NaturalLanguagePropertySearchService({} as never, {} as never, {} as never);

    const interpretation = service.interpret({
      locale: "ru",
      query: "подбери квартиру в паттайе в аренду рядом с волкинг стрит, въезжаю через семь дней"
    });

    expect(interpretation.filters).toMatchObject({
      listingType: "rent",
      market: "pattaya"
    });
    expect(interpretation.purpose).not.toBe("family");
    expect(interpretation.filters).not.toHaveProperty("minBedrooms");
    expect(interpretation.rankingExplanation).not.toContain("family fit");
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

  it("geocodes a named place once and applies radius filters before indexed and Postgres search", async () => {
    const boyzTown = { latitude: 12.9298, longitude: 100.8789 };
    const nearStudio = propertyFactory({
      id: "near-studio",
      kind: "condo",
      listingType: "rent",
      location: { latitude: 12.93, longitude: 100.879 },
      rentalPriceMonthly: { amount: 18_000, currency: "THB" },
      title: "Studio near Boyz Town"
    });
    const farStudio = propertyFactory({
      id: "far-studio",
      kind: "condo",
      listingType: "rent",
      location: { latitude: 12.99, longitude: 100.99 },
      rentalPriceMonthly: { amount: 16_000, currency: "THB" },
      title: "Far Studio"
    });
    const indexedRequests: unknown[] = [];
    const postgresRequests: unknown[] = [];
    let geocodeCalls = 0;
    const repository = {
      findById: async (_tenantId: string, propertyId: string) => propertyId === farStudio.id ? farStudio : null,
      search: async (_tenantId: string, filters: unknown) => {
        postgresRequests.push(filters);

        return [nearStudio, farStudio];
      }
    };
    const indexedSearch = {
      search: async (_tenantId: string, filters: unknown) => {
        indexedRequests.push(filters);

        return {
          filters,
          index: "propertyflow-properties-v1",
          items: [{ propertyId: farStudio.id }],
          total: 1
        };
      }
    };
    const locationIntelligence = {
      resolveComparisonTarget: async (message: string, market?: string) => {
        geocodeCalls += 1;
        expect(message).toBe("Studio near Boyz Town");
        expect(market).toBe("pattaya");

        return {
          kind: "poi",
          poi: {
            aliases: ["Boyz Town"],
            category: "nightlife",
            id: "geocoded-boyz-town",
            label: "Boyz Town",
            location: boyzTown,
            market: "pattaya"
          }
        };
      }
    };
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never, {
      rankCandidates: async () => []
    } as never, locationIntelligence as never);

    const result = await service.search("demo-agency", {
      locale: "en",
      market: "pattaya",
      query: "Studio near Boyz Town"
    });

    expect(geocodeCalls).toBe(1);
    expect(indexedRequests).toEqual([
      expect.objectContaining({
        near: boyzTown,
        radiusMeters: 3000
      })
    ]);
    expect(postgresRequests).toEqual([
      expect.objectContaining({
        near: boyzTown,
        radiusMeters: 3000
      })
    ]);
    expect(result.filters).toMatchObject({
      market: "pattaya",
      minBedrooms: 0,
      near: boyzTown,
      radiusMeters: 3000
    });
    expect(result.items.map((item) => item.id)).toEqual(["near-studio"]);
    expect(result.rankingExplanation).toContain('Map geocoding resolved "Boyz Town" once');
  });

  it("treats studio or 1 bedroom refinements as an upper bedroom cap", async () => {
    const twoBedroom = propertyFactory({
      bedrooms: 2,
      id: "two-bedroom",
      listingType: "rent",
      rentalPriceMonthly: { amount: 28_000, currency: "THB" },
      title: "2BR Condo at Grand Avenue Residence"
    });
    const oneBedroom = propertyFactory({
      bedrooms: 1,
      id: "one-bedroom",
      listingType: "rent",
      rentalPriceMonthly: { amount: 30_000, currency: "THB" },
      title: "1BR Condo at Grand Avenue Residence"
    });
    const studio = propertyFactory({
      bedrooms: 0,
      id: "studio",
      listingType: "rent",
      rentalPriceMonthly: { amount: 18_000, currency: "THB" },
      title: "Studio Condo at The Base Central Pattaya"
    });
    const byId = new Map([
      [twoBedroom.id, twoBedroom],
      [oneBedroom.id, oneBedroom],
      [studio.id, studio]
    ]);
    const repository = {
      findById: async (_tenantId: string, propertyId: string) => byId.get(propertyId) ?? null,
      search: async () => [twoBedroom, oneBedroom, studio]
    };
    const indexedSearch = {
      search: async () => ({
        filters: { query: "rent near central pattaya, only 1 bedroom or studio" },
        index: "propertyflow-properties-v1",
        items: [{ propertyId: twoBedroom.id }, { propertyId: oneBedroom.id }, { propertyId: studio.id }],
        total: 3
      })
    };
    const service = new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never, {
      rankCandidates: async () => []
    } as never);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "find me a condo for rent near central pattaya. Updated criteria: show me only 1 bedroom or studio"
    });

    expect(result.filters).toMatchObject({
      listingType: "rent",
      market: "pattaya",
      minBedrooms: 0,
      maxBedrooms: 1
    });
    expect(result.items.map((item) => item.id)).toEqual(["one-bedroom", "studio"]);
    expect(result.items).not.toContainEqual(expect.objectContaining({ bedrooms: 2 }));
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
    expect(result.rankingExplanation).toContain("larger layouts");
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

  it("reranks budget requests toward cheaper matching listings", async () => {
    const cheap = propertyFactory({ id: "cheap", price: { amount: 2_200_000, currency: "THB" }, title: "Affordable Pattaya Condo" });
    const expensive = propertyFactory({ id: "expensive", price: { amount: 4_800_000, currency: "THB" }, title: "Pricier Pattaya Condo" });
    const service = searchServiceForItems([expensive, cheap]);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "show me budget-friendly affordable condos in Pattaya under 5m"
    });

    expect(result.items.map((item) => item.id)).toEqual(["cheap", "expensive"]);
    expect(result.rankingExplanation).toContain("budget price");
  });

  it("reranks premium requests toward luxury signals", async () => {
    const basic = propertyFactory({
      amenities: ["pool"],
      areaSqm: 60,
      id: "basic",
      price: { amount: 6_000_000, currency: "THB" },
      title: "Large Basic Condo"
    });
    const premium = propertyFactory({
      amenities: ["sea-view", "gym", "sauna", "covered parking"],
      areaSqm: 52,
      id: "premium",
      price: { amount: 5_700_000, currency: "THB" },
      title: "Premium Sea View Condo"
    });
    const service = searchServiceForItems([basic, premium]);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "show me a premium luxury condo in Pattaya"
    });

    expect(result.items.map((item) => item.id)).toEqual(["premium", "basic"]);
    expect(result.rankingExplanation).toContain("premium fit");
  });

  it("reranks best-value requests toward larger lower-price-per-sqm listings", async () => {
    const poorValue = propertyFactory({
      areaSqm: 32,
      id: "poor-value",
      price: { amount: 4_500_000, currency: "THB" },
      title: "Compact Expensive Condo"
    });
    const goodValue = propertyFactory({
      areaSqm: 70,
      id: "good-value",
      price: { amount: 4_900_000, currency: "THB" },
      title: "Large Value Condo"
    });
    const service = searchServiceForItems([poorValue, goodValue]);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "show me the best value for money condo in Pattaya under 5m"
    });

    expect(result.items.map((item) => item.id)).toEqual(["good-value", "poor-value"]);
    expect(result.rankingExplanation).toContain("value for money");
  });

  it("reranks beach-proximity requests toward closer listings", async () => {
    const far = propertyFactory({ beachDistanceMeters: 900, id: "far", title: "Farther Condo" });
    const close = propertyFactory({ beachDistanceMeters: 150, id: "close", title: "Close Beach Condo" });
    const service = searchServiceForItems([far, close]);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "show me a condo near the beach in Pattaya"
    });

    expect(result.items.map((item) => item.id)).toEqual(["close", "far"]);
    expect(result.rankingExplanation).toContain("beach proximity");
  });

  it("recognizes adults-only nightlife stays and applies nightlife geo/ranking preferences", async () => {
    const central = propertyFactory({
      address: "Central Pattaya",
      amenities: ["24h security", "covered parking"],
      bedrooms: 0,
      id: "central-nightlife",
      location: { latitude: 12.928, longitude: 100.874 },
      title: "Central Pattaya Nightlife Studio"
    });
    const quiet = propertyFactory({
      address: "Huai Yai",
      amenities: ["garden"],
      id: "quiet-retreat",
      location: { latitude: 12.84, longitude: 100.98 },
      title: "Quiet Garden Studio"
    });
    const service = searchServiceForItems([quiet, central]);

    const result = await service.search("demo-agency", {
      locale: "en",
      market: "pattaya",
      query: "adults only studio near nightlife in Pattaya"
    });

    expect(result.filters.lifestyleSignals).toContain("nightlife");
    expect(result.filters.near).toMatchObject({ latitude: 12.9279, longitude: 100.8738 });
    expect(result.filters.radiusMeters).toBe(3000);
    expect(result.items.map((item) => item.id)).toEqual(["central-nightlife"]);
    expect(result.rankingExplanation).toContain("nightlife access");
  });

  it("recognizes freelancer and digital nomad searches and reranks toward remote-work fit", async () => {
    const basic = propertyFactory({
      amenities: ["pool"],
      id: "basic",
      title: "Basic Studio"
    });
    const remoteReady = propertyFactory({
      amenities: ["fast-internet", "fiber-internet", "coworking", "workspace"],
      areaSqm: 52,
      id: "remote-ready",
      title: "Digital Nomad Coworking Condo"
    });
    const service = searchServiceForItems([basic, remoteReady]);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "freelancer digital nomad condo in Pattaya with good internet"
    });

    expect(result.filters.lifestyleSignals).toContain("remote-work");
    expect(result.filters.requiredAmenities).toContain("fast-internet");
    expect(result.items.map((item) => item.id)).toEqual(["remote-ready"]);
    expect(result.rankingExplanation).toContain("remote-work fit");
  });

  it("recognizes retiree comfort searches and reranks toward easy daily living", async () => {
    const nightlifeStudio = propertyFactory({
      amenities: ["pool"],
      floor: 22,
      id: "nightlife-studio",
      title: "Central Party Studio"
    });
    const seniorComfort = propertyFactory({
      amenities: ["elevator", "24h security", "shuttle service", "garden", "pool"],
      floor: 4,
      id: "senior-comfort",
      title: "Retirement Comfort Condo"
    });
    const service = searchServiceForItems([nightlifeStudio, seniorComfort]);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "condo in Pattaya for retired senior living"
    });

    expect(result.filters.lifestyleSignals).toContain("retiree-comfort");
    expect(result.items.map((item) => item.id)).toEqual(["senior-comfort", "nightlife-studio"]);
    expect(result.rankingExplanation).toContain("retiree comfort");
  });

  it("recognizes winter and long-stay searches and reranks toward practical long-stay amenities", async () => {
    const shortStay = propertyFactory({
      amenities: ["sea-view"],
      beachDistanceMeters: 2500,
      id: "short-stay",
      title: "Short Stay View Studio"
    });
    const winterReady = propertyFactory({
      amenities: ["washing machine", "balcony", "pool", "gym", "high-speed internet"],
      beachDistanceMeters: 900,
      id: "winter-ready",
      title: "Winter Long-Stay Condo"
    });
    const service = searchServiceForItems([shortStay, winterReady]);

    const result = await service.search("demo-agency", {
      locale: "en",
      query: "winter long stay condo in Pattaya for snowbird living"
    });

    expect(result.filters.lifestyleSignals).toContain("winter-stay");
    expect(result.items.map((item) => item.id)).toEqual(["winter-ready", "short-stay"]);
    expect(result.rankingExplanation).toContain("winter-stay comfort");
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

function searchServiceForItems(items: PropertySnapshot[]): NaturalLanguagePropertySearchService {
  const byId = new Map(items.map((item) => [item.id, item]));
  const repository = {
    findById: async (_tenantId: string, propertyId: string) => byId.get(propertyId) ?? null,
    search: async () => items
  };
  const indexedSearch = {
    search: async () => ({
      filters: { query: "relative preference search" },
      index: "propertyflow-properties-v1",
      items: items.map((item) => ({ propertyId: item.id })),
      total: items.length
    })
  };

  return new NaturalLanguagePropertySearchService(repository as never, indexedSearch as never, {
    rankCandidates: async () => []
  } as never);
}

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
