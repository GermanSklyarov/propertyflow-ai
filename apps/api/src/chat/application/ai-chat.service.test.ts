import { Logger, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { KnowledgeDocumentChunkSnapshot } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { AiChatService } from "./ai-chat.service.js";
import { OpenAiTextGenerator, type AiTextGenerator } from "./ai-text-generator.js";
import type { LocationIntelligenceService } from "./location-intelligence.js";

describe("AiChatService", () => {
  afterEach(() => {
    delete process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK;
    delete process.env.AI_DEFAULT_PROVIDER;
    delete process.env.AI_CHAT_MODEL;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_CHAT_MODEL;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.MAPBOX_ACCESS_TOKEN;
    delete process.env.MAP_GEOCODING_PROVIDER;
    vi.restoreAllMocks();
  });

  it("uses a configured LLM provider to generate the final tenant-scoped answer", async () => {
    const property = propertyFactory({
      description:
        "High-floor condo near Wongamat beach with sea view, fiber internet, pool, gym, and strong winter rental appeal.",
      floor: 8,
      maintenanceFeeMonthly: {
        amount: 2800,
        currency: "THB"
      },
      monthlyRentEstimate: {
        amount: 28000,
        currency: "THB"
      },
      project: {
        amenities: ["pool", "gym", "security"],
        createdAt: "2026-07-21T00:00:00.000Z",
        developer: "Riviera Group",
        id: "project-1",
        market: "pattaya",
        name: "The Riviera Wongamat",
        status: "completed",
        tenantId: "tenant-1",
        updatedAt: "2026-07-21T00:00:00.000Z"
      }
    });
    const chunk = knowledgeChunkFactory();
    const textGenerator: AiTextGenerator = {
      isConfigured: vi.fn().mockReturnValue(true),
      generate: vi.fn().mockResolvedValue({
        answer: "A real model answer grounded in Wongamat Sea View Residence and the buying guide.",
        provider: "openai",
        model: "configured-model"
      })
    };
    const service = serviceFactory({
      textGenerator,
      searchItems: [property],
      knowledgeItems: [chunk]
    });

    const response = await service.ask(
      "tenant-1",
      {
        conversation: [
          { role: "user", text: "find me a condo in pattaya under 3m" },
          { role: "assistant", text: "I found Central Pattaya condos under 3M." },
          { role: "user", text: "i am going to live alone and work remotely" }
        ],
        locale: "en",
        message: "I need a sea-view condo under 5M in Pattaya"
      },
      {
        persona: {
          gender: "feminine",
          name: "Anna",
          tone: "friendly",
          welcomeMessage: "Hi! I'm Anna, your AI property consultant."
        }
      }
    );

    expect(response.answer).toBe("A real model answer grounded in Wongamat Sea View Residence and the buying guide.");
    expect(response.generation).toEqual({
      mode: "llm",
      provider: "openai",
      model: "configured-model"
    });
    expect(response.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: "Missing maintenance fee makes ownership cost incomplete.",
          kind: "risk",
          propertyId: "property-1",
          severity: "warning"
        }),
        expect.objectContaining({
          detail: "What is the exact foreign quota status for this unit?",
          kind: "due_diligence",
          propertyId: "property-1"
        })
      ])
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en",
        message: "I need a sea-view condo under 5M in Pattaya",
        context: expect.stringContaining("Wongamat Sea View Residence"),
        persona: {
          gender: "feminine",
          name: "Anna",
          tone: "friendly",
          welcomeMessage: "Hi! I'm Anna, your AI property consultant."
        }
      })
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining("Recent conversation. Use it to resolve follow-up references")
      })
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining("i am going to live alone and work remotely")
      })
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining("Foreign ownership process")
      })
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining("Structured due diligence context")
      })
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining("Structured listing evidence")
      })
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining("amenities=sea-view, pool, fast-internet")
      })
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining("project=The Riviera Wongamat")
      })
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining("maintenanceFee=2800 THB/mo")
      })
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining("beachDistance=240m")
      })
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining("description=High-floor condo near Wongamat beach with sea view")
      })
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining("Missing maintenance fee makes ownership cost incomplete.")
      })
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.not.stringContaining("1. Wongamat Sea View Residence")
      })
    );
  });

  it("does not pretend deterministic retrieval is AI when no provider is configured", async () => {
    const service = serviceFactory({
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    await expect(
      service.ask("tenant-1", {
        locale: "en",
        message: "Find condos in Pattaya"
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("marks deterministic local output as fallback only when explicitly enabled", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const property = propertyFactory();
    const service = serviceFactory({
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      },
      searchItems: [property]
    });

    const response = await service.ask("tenant-1", {
      locale: "en",
      message: "Find condos in Pattaya"
    });

    expect(response.answer).toContain("I found 1 matching listing.");
    expect(response.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "risk",
          title: "Wongamat Sea View Residence risk check"
        })
      ])
    );
    expect(response.generation).toMatchObject({
      mode: "deterministic-fallback"
    });
  });

  it("uses search result filters for structured fallback without re-interpreting the request", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const fallbackProperty = propertyFactory({
      id: "fallback-property",
      title: "Structured Fallback Condo"
    });
    const properties = {
      findById: vi.fn().mockResolvedValue(propertyFactory()),
      search: vi.fn().mockResolvedValue([fallbackProperty])
    };
    const naturalLanguageSearch = {
      interpret: vi.fn().mockReturnValue({
        filters: { market: "bangkok" },
        interpretedIntent: "Stale interpretation",
        rankingExplanation: "This should not be used."
      }),
      search: vi.fn().mockResolvedValue({
        filters: { market: "pattaya", maxPriceThb: 3_000_000 },
        interpretedIntent: "Pattaya condo under 3M",
        items: [],
        rankingExplanation: "Indexed search returned no hits.",
        total: 0
      })
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      properties,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      locale: "en",
      message: "Find a condo in Pattaya under 3M"
    });

    expect(naturalLanguageSearch.interpret).not.toHaveBeenCalled();
    expect(properties.search).toHaveBeenCalledWith("tenant-1", { market: "pattaya", maxPriceThb: 3_000_000 });
    expect(response.answer).toContain("Structured Fallback Condo");
    expect(response.answer).toContain("structured PostgreSQL filters as a fallback");
  });

  it("uses structured repository fallback when natural language listing search fails", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const fallbackProperty = propertyFactory({
      id: "fallback-property",
      title: "Search Failure Fallback Condo"
    });
    const properties = {
      findById: vi.fn().mockResolvedValue(propertyFactory()),
      search: vi.fn().mockResolvedValue([fallbackProperty])
    };
    const naturalLanguageSearch = {
      interpret: vi.fn().mockReturnValue({
        filters: { listingType: "sale", market: "pattaya", maxPriceThb: 3_000_000 },
        interpretedIntent: "Pattaya condo under 3M",
        rankingExplanation: "Local interpreter extracted market and budget."
      }),
      search: vi.fn().mockRejectedValue(new Error("opensearch unavailable"))
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      properties,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      locale: "en",
      market: "pattaya",
      message: "Find a condo in Pattaya under 3M"
    });

    expect(properties.search).toHaveBeenCalledWith("tenant-1", {
      listingType: "sale",
      market: "pattaya",
      maxPriceThb: 3_000_000
    });
    expect(naturalLanguageSearch.interpret).toHaveBeenCalledWith({
      locale: "en",
      market: "pattaya",
      purpose: undefined,
      query: "Find a condo in Pattaya under 3M"
    });
    expect(response.answer).toContain("Search Failure Fallback Condo");
    expect(response.answer).toContain("Indexed natural-language search was unavailable");
    expect(warn).toHaveBeenCalledWith(
      "AI chat listing search failed for tenant tenant-1: opensearch unavailable"
    );
  });

  it("uses request filters when listing search and fallback interpretation both fail", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const fallbackProperty = propertyFactory({
      id: "fallback-property",
      title: "Basic Fallback Condo"
    });
    const properties = {
      findById: vi.fn().mockResolvedValue(propertyFactory()),
      search: vi.fn().mockResolvedValue([fallbackProperty])
    };
    const naturalLanguageSearch = {
      interpret: vi.fn().mockImplementation(() => {
        throw new Error("interpreter unavailable");
      }),
      search: vi.fn().mockRejectedValue(new Error("opensearch unavailable"))
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      properties,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      locale: "en",
      market: "pattaya",
      message: "Find a condo in Pattaya under 3M"
    });

    expect(properties.search).toHaveBeenCalledWith("tenant-1", {
      market: "pattaya",
      query: "Find a condo in Pattaya under 3M"
    });
    expect(response.answer).toContain("Basic Fallback Condo");
    expect(warn).toHaveBeenCalledWith(
      "AI chat structured fallback interpretation failed: interpreter unavailable"
    );
  });

  it("continues from listing evidence when knowledge retrieval fails", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const property = propertyFactory();
    const knowledge = {
      searchChunks: vi.fn().mockRejectedValue(new Error("vector index unavailable"))
    };
    const service = serviceFactory({
      knowledge,
      searchItems: [property],
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      locale: "en",
      message: "Find condos in Pattaya"
    });

    expect(knowledge.searchChunks).toHaveBeenCalledWith("tenant-1", {
      limit: 3,
      locale: "en",
      query: "Find condos in Pattaya"
    });
    expect(response.answer).toContain("I found 1 matching listing.");
    expect(response.answer).toContain("Wongamat Sea View Residence");
    expect(response.citations).toEqual(expect.not.arrayContaining([expect.objectContaining({ source: "knowledge" })]));
    expect(warn).toHaveBeenCalledWith(
      "AI chat knowledge retrieval failed for tenant tenant-1: vector index unavailable"
    );
  });

  it("uses previous recommendations for viewing follow-ups instead of running a fresh listing search", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const service = serviceFactory({
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      },
      searchItems: [
        propertyFactory({
          id: "property-new-search",
          title: "New Search Result Condo"
        })
      ]
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        {
          recommendedListings: [
            { propertyId: "property-1", title: "Price Comparable A" },
            { propertyId: "property-2", title: "Pricing Metadata Smoke Condo" },
            { propertyId: "property-3", title: "Price Recommendation Target Condo" }
          ],
          role: "assistant",
          text: "I found 6 matching listings. Top matches: Price Comparable A, Pricing Metadata Smoke Condo, Price Recommendation Target Condo."
        }
      ],
      locale: "en",
      message: "I like the first option, may I see it?"
    });

    expect(response.matchedPropertyIds).toEqual(["property-1"]);
    expect(response.answer).toContain("Wongamat Sea View Residence");
    expect(response.answer).not.toContain("New Search Result Condo");
  });

  it("answers viewing requests with a handoff prompt and the requested slot", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const propertyById = new Map([
      ["property-1", propertyFactory({ id: "property-1", title: "Pratumnak Investment One-Bed" })],
      [
        "property-2",
        propertyFactory({
          id: "property-2",
          listingType: "rent",
          rentalPriceMonthly: { amount: 19_000, currency: "THB" },
          title: "Terminal 21 Walkable Studio"
        })
      ]
    ]);
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn()
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      properties: {
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) => Promise.resolve(propertyById.get(propertyId) ?? null)),
        search: vi.fn()
      },
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        {
          recommendedListings: [
            { propertyId: "property-1", title: "Pratumnak Investment One-Bed" },
            { propertyId: "property-2", title: "Terminal 21 Walkable Studio" }
          ],
          role: "assistant",
          text: "I found two options."
        }
      ],
      locale: "en",
      message: "i like the second option, can i view it tomorrow at 3 p.m?"
    });

    expect(naturalLanguageSearch.search).not.toHaveBeenCalled();
    expect(response.matchedPropertyIds).toEqual(["property-2"]);
    expect(response.answer).toContain("I can help arrange a viewing of Terminal 21 Walkable Studio for tomorrow at 3 p.m");
    expect(response.answer).toContain("Please share your WhatsApp, Telegram, phone, or email");
    expect(response.answer).not.toContain("Terminal 21 Walkable Studio is a 1-bedroom condo");
  });

  it("keeps rental availability follow-ups on the selected listing instead of rerunning search", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const propertyById = new Map([
      [
        "property-1",
        propertyFactory({
          id: "property-1",
          listingType: "rent",
          rentalPriceMonthly: { amount: 24_000, currency: "THB" },
          title: "1BR Condo at Siam Oriental Tropical Garden - Pratumnak"
        })
      ],
      [
        "property-2",
        propertyFactory({
          id: "property-2",
          listingType: "rent",
          rentalPriceMonthly: { amount: 25_000, currency: "THB" },
          title: "1BR Condo at City Garden Pratumnak - Pratumnak"
        })
      ]
    ]);
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn()
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      properties: {
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) => Promise.resolve(propertyById.get(propertyId) ?? null)),
        search: vi.fn()
      },
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        {
          recommendedListings: [
            { propertyId: "property-1", title: "1BR Condo at Siam Oriental Tropical Garden - Pratumnak" },
            { propertyId: "property-2", title: "1BR Condo at City Garden Pratumnak - Pratumnak" }
          ],
          role: "assistant",
          text: "I found 3 matching listings."
        }
      ],
      locale: "en",
      message: "I like the first option and I want to rent on 1st september it's possible?"
    });

    expect(naturalLanguageSearch.search).not.toHaveBeenCalled();
    expect(response.matchedPropertyIds).toEqual(["property-1"]);
    expect(response.answer).toContain("I can help arrange a viewing of 1BR Condo at Siam Oriental Tropical Garden - Pratumnak for 1st september");
    expect(response.answer).toContain("Rental ask is 24000 THB/mo");
    expect(response.answer).not.toContain("I found 3 matching listings");
  });

  it("answers Russian viewing requests in Russian without inventing a preferred slot", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const propertyById = new Map([
      [
        "property-2",
        propertyFactory({
          id: "property-2",
          listingType: "rent",
          rentalPriceMonthly: { amount: 19_000, currency: "THB" },
          title: "Terminal 21 Walkable Studio"
        })
      ]
    ]);
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn()
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      properties: {
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) => Promise.resolve(propertyById.get(propertyId) ?? null)),
        search: vi.fn()
      },
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        {
          recommendedListings: [{ propertyId: "property-2", title: "Terminal 21 Walkable Studio" }],
          role: "assistant",
          text: "Я нашла 1 подходящий вариант."
        }
      ],
      locale: "ru",
      message: "как записаться на просмотр?"
    });

    expect(naturalLanguageSearch.search).not.toHaveBeenCalled();
    expect(response.matchedPropertyIds).toEqual(["property-2"]);
    expect(response.answer).toContain("Я помогу записаться на просмотр Terminal 21 Walkable Studio");
    expect(response.answer).toContain("Напишите, пожалуйста, удобный день и время для просмотра");
    expect(response.answer).toContain("Оставьте WhatsApp, Telegram, телефон или email");
    expect(response.answer).toContain("Арендная ставка: 19000 THB/мес.");
    expect(response.answer).not.toContain("preferred slot");
    expect(response.answer).not.toContain("Great choice");
  });

  it("does not let the LLM rewrite grounded viewing handoff answers", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "false";
    const propertyById = new Map([
      [
        "property-2",
        propertyFactory({
          id: "property-2",
          listingType: "rent",
          rentalPriceMonthly: { amount: 19_000, currency: "THB" },
          title: "1BR Condo at The Ville Jomtien - East Pattaya"
        })
      ]
    ]);
    const textGenerator = {
      isConfigured: vi.fn().mockReturnValue(true),
      generate: vi.fn().mockResolvedValue({
        answer: "Мне не хватает информации об этом объекте.",
        model: "test-model",
        provider: "test"
      })
    };
    const service = serviceFactory({
      properties: {
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) => Promise.resolve(propertyById.get(propertyId) ?? null)),
        search: vi.fn()
      },
      textGenerator
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        {
          recommendedListings: [{ propertyId: "property-2", title: "1BR Condo at The Ville Jomtien - East Pattaya" }],
          role: "assistant",
          text: "Я нашла 1 подходящий вариант."
        }
      ],
      locale: "ru",
      message: "пойдет, как записаться на просмотр?"
    });

    expect(textGenerator.generate).not.toHaveBeenCalled();
    expect(response.answer).toContain("Я помогу записаться на просмотр 1BR Condo at The Ville Jomtien - East Pattaya");
    expect(response.answer).toContain("Оставьте WhatsApp, Telegram, телефон или email");
    expect(response.answer).not.toContain("не хватает информации");
  });

  it("compares the previous recommendation shortlist instead of searching again", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const propertyById = new Map([
      [
        "property-1",
        propertyFactory({
          beachDistanceMeters: 500,
          id: "property-1",
          title: "Price Comparable A"
        })
      ],
      [
        "property-2",
        propertyFactory({
          beachDistanceMeters: 500,
          id: "property-2",
          title: "Pricing Metadata Smoke Condo"
        })
      ],
      [
        "property-3",
        propertyFactory({
          beachDistanceMeters: 450,
          id: "property-3",
          title: "Price Recommendation Target Condo"
        })
      ]
    ]);
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn()
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      properties: {
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) => Promise.resolve(propertyById.get(propertyId) ?? null)),
        search: vi.fn()
      },
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        {
          recommendedListings: [
            { propertyId: "property-1", title: "Price Comparable A" },
            { propertyId: "property-2", title: "Pricing Metadata Smoke Condo" },
            { propertyId: "property-3", title: "Price Recommendation Target Condo" }
          ],
          role: "assistant",
          text: "I found 6 matching listings. Top matches: Price Comparable A, Pricing Metadata Smoke Condo, Price Recommendation Target Condo."
        }
      ],
      locale: "en",
      message: "Which one of them is closer to the beach?"
    });

    expect(naturalLanguageSearch.search).not.toHaveBeenCalled();
    expect(response.matchedPropertyIds).toEqual(["property-1", "property-2", "property-3"]);
    expect(response.answer).toContain("Price Recommendation Target Condo is closest to the beach at 450m");
    expect(response.answer).toContain("Price Comparable A: 500m from the beach");
    expect(response.answer).not.toContain("Wongamat Sea View Residence");
  });

  it("recommends value for money from the previous shortlist instead of searching again", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const propertyById = new Map([
      [
        "property-1",
        propertyFactory({
          areaSqm: 31.9,
          beachDistanceMeters: 10776,
          id: "property-1",
          listingType: "rent",
          price: { amount: 2_800_000, currency: "THB" },
          rentalPriceMonthly: { amount: 14000, currency: "THB" },
          title: "Studio Condo at Huai Yai Villas - Huai Yai"
        })
      ],
      [
        "property-2",
        propertyFactory({
          areaSqm: 34.4,
          beachDistanceMeters: 1731,
          id: "property-2",
          listingType: "rent",
          price: { amount: 3_000_000, currency: "THB" },
          rentalPriceMonthly: { amount: 17000, currency: "THB" },
          title: "Studio Condo at Del Mare Bangsaray - Bang Saray"
        })
      ],
      [
        "property-3",
        propertyFactory({
          areaSqm: 36.8,
          beachDistanceMeters: 1020,
          id: "property-3",
          listingType: "rent",
          price: { amount: 3_100_000, currency: "THB" },
          rentalPriceMonthly: { amount: 18000, currency: "THB" },
          title: "Studio Condo at Club Royal - Naklua"
        })
      ]
    ]);
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn()
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      properties: {
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) => Promise.resolve(propertyById.get(propertyId) ?? null)),
        search: vi.fn()
      },
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        {
          recommendedListings: [
            { propertyId: "property-1", title: "Studio Condo at Huai Yai Villas - Huai Yai" },
            { propertyId: "property-2", title: "Studio Condo at Del Mare Bangsaray - Bang Saray" },
            { propertyId: "property-3", title: "Studio Condo at Club Royal - Naklua" }
          ],
          role: "assistant",
          text: "I found 8 matching listings. Here are the top 3 I can show now."
        },
        { role: "user", text: "which one of them is closer to the beach?" },
        {
          recommendedListings: [
            { propertyId: "property-1", title: "Studio Condo at Huai Yai Villas - Huai Yai" },
            { propertyId: "property-2", title: "Studio Condo at Del Mare Bangsaray - Bang Saray" },
            { propertyId: "property-3", title: "Studio Condo at Club Royal - Naklua" }
          ],
          role: "assistant",
          text: "Club Royal is closest to the beach."
        }
      ],
      locale: "en",
      message: "I'm not sure, which one would you recommend in terms of value for money?"
    });

    expect(naturalLanguageSearch.search).not.toHaveBeenCalled();
    expect(response.matchedPropertyIds).toEqual(["property-1", "property-2", "property-3"]);
    expect(response.answer).toContain("Studio Condo at Club Royal - Naklua looks strongest for value for money");
    expect(response.answer).toContain("Studio Condo at Huai Yai Villas - Huai Yai: 14000 THB/mo");
    expect(response.answer).not.toContain("Once Pattaya");
  });

  it("compares shortlist options against named city POIs using coordinates", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const propertyById = new Map([
      [
        "property-1",
        propertyFactory({
          id: "property-1",
          location: { latitude: 12.836, longitude: 100.99 },
          title: "Studio Condo at Huai Yai Villas - Huai Yai"
        })
      ],
      [
        "property-2",
        propertyFactory({
          id: "property-2",
          location: { latitude: 12.765, longitude: 100.898 },
          title: "Studio Condo at Del Mare Bangsaray - Bang Saray"
        })
      ],
      [
        "property-3",
        propertyFactory({
          id: "property-3",
          location: { latitude: 12.976, longitude: 100.884 },
          title: "Studio Condo at Club Royal - Naklua"
        })
      ]
    ]);
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn()
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      properties: {
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) => Promise.resolve(propertyById.get(propertyId) ?? null)),
        search: vi.fn()
      },
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        {
          recommendedListings: [
            { propertyId: "property-1", title: "Studio Condo at Huai Yai Villas - Huai Yai" },
            { propertyId: "property-2", title: "Studio Condo at Del Mare Bangsaray - Bang Saray" },
            { propertyId: "property-3", title: "Studio Condo at Club Royal - Naklua" }
          ],
          role: "assistant",
          text: "I found 8 matching listings. Here are the top 3 I can show now."
        }
      ],
      locale: "en",
      message: "which one of them is closer to walking street?"
    });

    expect(naturalLanguageSearch.search).not.toHaveBeenCalled();
    expect(response.matchedPropertyIds).toEqual(["property-1", "property-2", "property-3"]);
    expect(response.answer).toContain("Studio Condo at Club Royal - Naklua is closest to Walking Street");
    expect(response.answer).toContain("Studio Condo at Club Royal - Naklua: about");
    expect(response.answer).toContain("from Walking Street");
    expect(response.answer).toContain("Studio Condo at Del Mare Bangsaray - Bang Saray: about");
  });

  it("compares shortlist options against arbitrary geocoded landmarks when map provider is configured", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const propertyById = new Map([
      [
        "property-1",
        propertyFactory({
          id: "property-1",
          location: { latitude: 12.94, longitude: 100.88 },
          title: "Central Pattaya Studio"
        })
      ],
      [
        "property-2",
        propertyFactory({
          id: "property-2",
          location: { latitude: 12.972, longitude: 100.889 },
          title: "Naklua Landmark Studio"
        })
      ]
    ]);
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn()
    };
    const locationIntelligence = {
      resolveComparisonTarget: vi.fn().mockResolvedValue({
        kind: "poi",
        poi: {
          aliases: ["Sanctuary of Truth"],
          category: "landmark",
          id: "geocoded-sanctuary-of-truth",
          label: "Sanctuary of Truth",
          location: { latitude: 12.9723, longitude: 100.8894 },
          market: "pattaya"
        }
      })
    } as unknown as LocationIntelligenceService;
    const service = serviceFactory({
      locationIntelligence,
      naturalLanguageSearch,
      properties: {
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) => Promise.resolve(propertyById.get(propertyId) ?? null)),
        search: vi.fn()
      },
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        {
          recommendedListings: [
            { propertyId: "property-1", title: "Central Pattaya Studio" },
            { propertyId: "property-2", title: "Naklua Landmark Studio" }
          ],
          role: "assistant",
          text: "I found two options."
        }
      ],
      locale: "en",
      message: "which one of them is closer to Sanctuary of Truth?"
    });

    expect(naturalLanguageSearch.search).not.toHaveBeenCalled();
    expect(locationIntelligence.resolveComparisonTarget).toHaveBeenCalledWith("which one of them is closer to Sanctuary of Truth?", "pattaya");
    expect(response.answer).toContain("Naklua Landmark Studio is closest to Sanctuary of Truth");
    expect(response.answer).toContain("Central Pattaya Studio: about");
    expect(response.matchedPropertyIds).toEqual(["property-1", "property-2"]);
  });

  it("explains map provider setup when arbitrary landmark geocoding is unavailable", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn()
    };
    const service = serviceFactory({
      locationIntelligence: {
        resolveComparisonTarget: vi.fn().mockResolvedValue(undefined)
      } as unknown as LocationIntelligenceService,
      naturalLanguageSearch,
      properties: {
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
          Promise.resolve(propertyFactory({ id: propertyId, title: propertyId }))
        ),
        search: vi.fn()
      },
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        {
          recommendedListings: [
            { propertyId: "property-1", title: "Option A" },
            { propertyId: "property-2", title: "Option B" }
          ],
          role: "assistant",
          text: "I found two options."
        }
      ],
      locale: "en",
      message: "which one of them is closer to a place not in the map?"
    });

    expect(naturalLanguageSearch.search).not.toHaveBeenCalled();
    expect(response.answer).toContain("could not match that place to the current city map data yet");
    expect(response.answer).toContain("map geocoding provider");
  });

  it("compares shortlist options for investment using listing facts", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const propertyById = new Map([
      [
        "property-1",
        propertyFactory({
          amenities: ["pool"],
          id: "property-1",
          monthlyRentEstimate: undefined,
          price: { amount: 2_900_000, currency: "THB" },
          title: "Budget Living Condo"
        })
      ],
      [
        "property-2",
        propertyFactory({
          amenities: ["sea-view", "pool"],
          id: "property-2",
          maintenanceFeeMonthly: { amount: 2200, currency: "THB" },
          monthlyRentEstimate: { amount: 30000, currency: "THB" },
          price: { amount: 3_200_000, currency: "THB" },
          title: "Yield Focus Condo"
        })
      ]
    ]);
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn()
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      properties: {
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) => Promise.resolve(propertyById.get(propertyId) ?? null)),
        search: vi.fn()
      },
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        {
          recommendedListings: [
            { propertyId: "property-1", title: "Budget Living Condo" },
            { propertyId: "property-2", title: "Yield Focus Condo" }
          ],
          role: "assistant",
          text: "I found two options."
        }
      ],
      locale: "en",
      message: "which one is better for investment?"
    });

    expect(naturalLanguageSearch.search).not.toHaveBeenCalled();
    expect(response.answer).toContain("Yield Focus Condo looks strongest for investment");
    expect(response.answer).toContain("estimated rent 30000 THB/mo");
    expect(response.matchedPropertyIds).toEqual(["property-1", "property-2"]);
  });

  it("keeps repeated details on the selected listing instead of searching again", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const propertyById = new Map([
      ["property-1", propertyFactory({ id: "property-1", title: "First Condo" })],
      [
        "property-2",
        propertyFactory({
          amenities: ["fiber-internet", "pool", "pet-friendly"],
          id: "property-2",
          title: "Second Pet Friendly Condo"
        })
      ]
    ]);
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn()
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      properties: {
        findById: vi.fn().mockImplementation((_tenantId: string, propertyId: string) => Promise.resolve(propertyById.get(propertyId) ?? null)),
        search: vi.fn()
      },
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        {
          recommendedListings: [
            { propertyId: "property-1", title: "First Condo" },
            { propertyId: "property-2", title: "Second Pet Friendly Condo" }
          ],
          role: "assistant",
          text: "I found two options."
        },
        { role: "user", text: "I like the second option" },
        {
          recommendedListings: [{ propertyId: "property-2", title: "Second Pet Friendly Condo" }],
          role: "assistant",
          text: "Second Pet Friendly Condo is a good fit."
        },
        { role: "user", text: "is it close to the beach?" },
        {
          recommendedListings: [{ propertyId: "property-2", title: "Second Pet Friendly Condo" }],
          role: "assistant",
          text: "It is close enough for daily beach access."
        }
      ],
      locale: "en",
      message: "can I bring a dog?"
    });

    expect(naturalLanguageSearch.search).not.toHaveBeenCalled();
    expect(response.matchedPropertyIds).toEqual(["property-2"]);
    expect(response.answer).toContain("Second Pet Friendly Condo looks suitable to check for pets");
    expect(response.answer).toContain("confirm the building's current pet rules");
  });

  it("reuses the previous search query when the visitor asks for more options", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn().mockResolvedValue({
        filters: { market: "pattaya", maxPriceThb: 3_000_000 },
        interpretedIntent: "Pattaya condo under 3M",
        items: [propertyFactory({ id: "property-2", title: "Another Pattaya Condo" })],
        rankingExplanation: "Continuing the Pattaya condo search.",
        total: 20
      })
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        { role: "user", text: "find me a condo in pattaya under 3m" },
        {
          recommendedListings: [{ propertyId: "property-1", title: "Pratumnak Investment One-Bed" }],
          role: "assistant",
          text: "I found 20 matching listings. Here is the top match."
        }
      ],
      locale: "en",
      message: "can I see more options?"
    });

    expect(naturalLanguageSearch.search).toHaveBeenCalledWith("tenant-1", {
      locale: "en",
      market: undefined,
      purpose: undefined,
      query: "find me a condo in pattaya under 3m"
    });
    expect(response.answer).toContain("Another Pattaya Condo");
  });

  it("merges a concrete refinement with the previous broad search signals", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn().mockResolvedValue({
        filters: { listingType: "rent", market: "pattaya", maxMonthlyRentThb: 30_000, requiredAmenities: ["pet-friendly"] },
        interpretedIntent: "Pattaya pet-friendly rental under 30k",
        items: [propertyFactory({ id: "property-2", listingType: "rent", title: "Pet Friendly Spacious Studio" })],
        rankingExplanation: "Using broad pet-friendly request plus clarified rental criteria.",
        total: 1
      })
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });
    const refinement =
      "i mean i would like to rent 1 bedroom or a studio, but quite spacious, beach distance is not important, budget is under 30k, i would like to move in next month";

    await service.ask("tenant-1", {
      conversation: [
        { role: "user", text: "i need a room in pattaya for living with 2 dogs" },
        {
          recommendedListings: [{ propertyId: "property-1", title: "3BR House at Dusit Grand Park 2" }],
          role: "assistant",
          text: "I found 16 matching listings."
        }
      ],
      locale: "en",
      message: refinement
    });

    expect(naturalLanguageSearch.search).toHaveBeenCalledWith("tenant-1", {
      locale: "en",
      market: undefined,
      purpose: undefined,
      query: `i need a room in pattaya for living with 2 dogs. Updated criteria: ${refinement}`
    });
  });

  it("keeps rental location context when the visitor narrows the layout to studio or 1 bedroom", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn().mockResolvedValue({
        filters: { listingType: "rent", market: "pattaya", minBedrooms: 0, maxBedrooms: 1 },
        interpretedIntent: "Central Pattaya studio or 1 bedroom rental",
        items: [propertyFactory({ id: "property-2", listingType: "rent", title: "1BR Condo at Grand Avenue Residence" })],
        rankingExplanation: "Using central Pattaya rental context plus updated bedroom cap.",
        total: 1
      })
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });
    const refinement = "show me only 1 bedroom or studio";

    await service.ask("tenant-1", {
      conversation: [
        { role: "user", text: "find me a condo for rent near central pattaya" },
        {
          recommendedListings: [{ propertyId: "property-1", title: "4BR Townhouse at Centric Sea Pattaya" }],
          role: "assistant",
          text: "I found 8 matching listings."
        }
      ],
      locale: "en",
      message: refinement
    });

    expect(naturalLanguageSearch.search).toHaveBeenCalledWith("tenant-1", {
      locale: "en",
      market: undefined,
      purpose: undefined,
      query: `find me a condo for rent near central pattaya. Updated criteria: ${refinement}`
    });
  });

  it("keeps Russian Pratumnak location context when the visitor refines rental criteria", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn().mockResolvedValue({
        filters: { listingType: "rent", market: "pattaya", maxPrice: 20_000 },
        interpretedIntent: "Pratumnak rental under 20k",
        items: [propertyFactory({ id: "property-2", listingType: "rent", title: "Studio Condo at Pratumnak" })],
        rankingExplanation: "Using Pratumnak rental context plus updated budget.",
        total: 1
      })
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });
    const baseSearch = "я ищу недорогую студию или однушку в паттайе на пратамнаке, что посоветуешь?";
    const refinement = "меня интересует аренда, бюджет до 20 тысяч, планирую въехать в конце ноября, контракт на полгода";

    await service.ask("tenant-1", {
      conversation: [
        { role: "user", text: baseSearch },
        {
          recommendedListings: [{ propertyId: "property-1", title: "1BR Condo at The Cliff - Pratumnak" }],
          role: "assistant",
          text: "Я нашла варианты на Пратамнаке."
        }
      ],
      locale: "ru",
      market: "pattaya",
      message: refinement
    });

    expect(naturalLanguageSearch.search).toHaveBeenCalledWith("tenant-1", {
      locale: "ru",
      market: "pattaya",
      purpose: undefined,
      query: `${baseSearch}. Updated criteria: ${refinement}`
    });
  });

  it("uses the latest Russian area refinement while keeping prior rent and budget constraints", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn().mockResolvedValue({
        filters: { listingType: "rent", market: "pattaya", maxPrice: 20_000 },
        interpretedIntent: "Jomtien rental under 20k",
        items: [propertyFactory({ id: "property-2", listingType: "rent", title: "Studio Condo at Jomtien" })],
        rankingExplanation: "Using Jomtien area refinement plus prior rental budget.",
        total: 1
      })
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });
    const previousRefinement = "меня интересует аренда, бюджет до 20 тысяч, планирую въехать в конце ноября, контракт на полгода";
    const areaRefinement = "может, на джомтьене что-то есть?";

    await service.ask("tenant-1", {
      conversation: [
        { role: "user", text: "я ищу недорогую студию или однушку в паттайе на пратамнаке, что посоветуешь?" },
        { role: "assistant", text: "Сейчас нет публичных карточек кондо рядом с Pratumnak под этот запрос." },
        { role: "user", text: previousRefinement },
        { role: "assistant", text: "Сейчас нет публичных карточек кондо рядом с Pratumnak под этот запрос." }
      ],
      locale: "ru",
      market: "pattaya",
      message: areaRefinement
    });

    expect(naturalLanguageSearch.search).toHaveBeenCalledWith("tenant-1", {
      locale: "ru",
      market: "pattaya",
      purpose: undefined,
      query: `${previousRefinement}. Updated criteria: ${areaRefinement}`
    });
  });

  it("merges Thai layout refinements with the previous rental search context", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn().mockResolvedValue({
        filters: { listingType: "rent", market: "pattaya", minBedrooms: 0, maxBedrooms: 1 },
        interpretedIntent: "Pattaya studio or 1 bedroom rental",
        items: [propertyFactory({ id: "property-2", listingType: "rent", title: "Central Pattaya Studio" })],
        rankingExplanation: "Using Thai refinement.",
        total: 1
      })
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });
    const refinement = "ขอเฉพาะ 1 ห้องนอนหรือสตูดิโอ";

    await service.ask("tenant-1", {
      conversation: [
        { role: "user", text: "หาคอนโดเช่าในพัทยาใกล้ central pattaya" },
        { role: "assistant", text: "I found rentals near Central Pattaya." }
      ],
      locale: "th",
      message: refinement
    });

    expect(naturalLanguageSearch.search).toHaveBeenCalledWith("tenant-1", {
      locale: "th",
      market: undefined,
      purpose: undefined,
      query: `หาคอนโดเช่าในพัทยาใกล้ central pattaya. Updated criteria: ${refinement}`
    });
  });

  it("merges Chinese layout refinements with the previous rental search context", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn().mockResolvedValue({
        filters: { listingType: "rent", market: "pattaya", minBedrooms: 0, maxBedrooms: 1 },
        interpretedIntent: "Pattaya studio or 1 bedroom rental",
        items: [propertyFactory({ id: "property-2", listingType: "rent", title: "Central Pattaya Studio" })],
        rankingExplanation: "Using Chinese refinement.",
        total: 1
      })
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });
    const refinement = "只看一室或开间";

    await service.ask("tenant-1", {
      conversation: [
        { role: "user", text: "找芭提雅 central pattaya 附近出租公寓" },
        { role: "assistant", text: "I found rentals near Central Pattaya." }
      ],
      locale: "zh",
      message: refinement
    });

    expect(naturalLanguageSearch.search).toHaveBeenCalledWith("tenant-1", {
      locale: "zh",
      market: undefined,
      purpose: undefined,
      query: `找芭提雅 central pattaya 附近出租公寓. Updated criteria: ${refinement}`
    });
  });

  it("reuses Thai and Chinese refinements after affirmative continuation messages", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn().mockResolvedValue({
        filters: { listingType: "rent", market: "pattaya" },
        interpretedIntent: "Continued refined search",
        items: [propertyFactory({ id: "property-2", listingType: "rent", title: "Refined Rental" })],
        rankingExplanation: "Using latest refinement.",
        total: 1
      })
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    await service.ask("tenant-1", {
      conversation: [
        { role: "user", text: "หาคอนโดเช่าในพัทยา" },
        { role: "assistant", text: "I found rentals." },
        { role: "user", text: "ขอเฉพาะ 1 ห้องนอนหรือสตูดิโอ" },
        { role: "assistant", text: "Should I search again with this criteria?" }
      ],
      locale: "th",
      message: "ได้ หาแบบที่ตรงเงื่อนไข"
    });

    await service.ask("tenant-1", {
      conversation: [
        { role: "user", text: "找芭提雅出租公寓" },
        { role: "assistant", text: "I found rentals." },
        { role: "user", text: "只看一室或开间" },
        { role: "assistant", text: "Should I search again with this criteria?" }
      ],
      locale: "zh",
      message: "可以，找符合条件的房源"
    });

    expect(naturalLanguageSearch.search).toHaveBeenNthCalledWith(1, "tenant-1", {
      locale: "th",
      market: undefined,
      purpose: undefined,
      query: "หาคอนโดเช่าในพัทยา. Updated criteria: ขอเฉพาะ 1 ห้องนอนหรือสตูดิโอ"
    });
    expect(naturalLanguageSearch.search).toHaveBeenNthCalledWith(2, "tenant-1", {
      locale: "zh",
      market: undefined,
      purpose: undefined,
      query: "找芭提雅出租公寓. Updated criteria: 只看一室或开间"
    });
  });

  it("reuses the last concrete refinement when the visitor confirms a new search", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const naturalLanguageSearch = {
      interpret: vi.fn(),
      search: vi.fn().mockResolvedValue({
        filters: { listingType: "rent", market: "pattaya", maxMonthlyRentThb: 30_000, requiredAmenities: ["pet-friendly"] },
        interpretedIntent: "Pattaya pet-friendly rental under 30k",
        items: [propertyFactory({ id: "property-2", listingType: "rent", title: "Pet Friendly Spacious Studio" })],
        rankingExplanation: "Continuing with the clarified rental criteria.",
        total: 1
      })
    };
    const service = serviceFactory({
      naturalLanguageSearch,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });
    const refinement =
      "i mean i would like to rent 1 bedroom or a studio, but quite spacious, beach distance is not important, budget is under 30k, i would like to move in next month";

    const response = await service.ask("tenant-1", {
      conversation: [
        { role: "user", text: "i need a room in pattaya for living with 2 dogs" },
        {
          recommendedListings: [{ propertyId: "property-1", title: "3BR House at Dusit Grand Park 2" }],
          role: "assistant",
          text: "I found 16 matching listings."
        },
        { role: "user", text: refinement },
        {
          recommendedListings: [{ propertyId: "property-1", title: "3BR House at Dusit Grand Park 2" }],
          role: "assistant",
          text: "Would you like me to search for new listings that fit these updated criteria?"
        }
      ],
      locale: "en",
      message: "yes, please, find something that fits my request"
    });

    expect(naturalLanguageSearch.search).toHaveBeenCalledWith("tenant-1", {
      locale: "en",
      market: undefined,
      purpose: undefined,
      query: `i need a room in pattaya for living with 2 dogs. Updated criteria: ${refinement}`
    });
    expect(response.answer).toContain("Pet Friendly Spacious Studio");
  });

  it("keeps additional search candidate ids available for public widget cards", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const searchItems = Array.from({ length: 12 }, (_, index) =>
      propertyFactory({ id: `property-${index + 1}`, title: `Search Candidate ${index + 1}` })
    );
    const service = serviceFactory({
      searchItems,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      conversation: [
        { role: "user", text: "find me a condo in pattaya under 30k/month" },
        {
          recommendedListings: [
            { propertyId: "property-1", title: "Terminal 21 Walkable Studio" },
            { propertyId: "property-2", title: "Central Pattaya Rental Loft" }
          ],
          role: "assistant",
          text: "I found 4 matching listings. Here are the top 2."
        }
      ],
      locale: "en",
      message: "show me all options"
    });

    expect(response.matchedPropertyIds).toEqual(searchItems.map((property) => property.id));
  });

  it("returns a chat response when a referenced listing is no longer available", async () => {
    const properties = {
      findById: vi.fn().mockResolvedValue(null),
      search: vi.fn()
    };
    const knowledge = {
      searchChunks: vi.fn()
    };
    const advisor = {
      summarize: vi.fn()
    };
    const service = serviceFactory({
      advisor,
      knowledge,
      properties,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      locale: "en",
      message: "Can I see this listing?",
      propertyId: "missing-property"
    });

    expect(response.answer).toContain("I cannot access that listing");
    expect(response.matchedPropertyIds).toEqual([]);
    expect(response.insights).toEqual([
      expect.objectContaining({
        kind: "handoff",
        propertyId: "missing-property",
        title: "Listing unavailable"
      })
    ]);
    expect(knowledge.searchChunks).not.toHaveBeenCalled();
    expect(advisor.summarize).not.toHaveBeenCalled();
    expect(properties.search).not.toHaveBeenCalled();
  });

  it("reuses the advisor summary for advice and due diligence on property detail answers", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const advisor = {
      summarize: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
        Promise.resolve({
          bestFor: ["living"],
          confidence: "medium",
          cons: ["Low floor may be less attractive for view-sensitive buyers."],
          generatedFrom: ["property-price", "property-location"],
          propertyId,
          pros: ["Sea view can support stronger resale and rental positioning."],
          questionsToAskAgent: ["What is the exact foreign quota status for this unit?"],
          risks: ["Missing maintenance fee makes ownership cost incomplete."]
        })
      )
    };
    const service = serviceFactory({
      advisor,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      locale: "en",
      message: "Is this listing a good investment?",
      propertyId: "property-1"
    });

    expect(advisor.summarize).toHaveBeenCalledTimes(1);
    expect(response.answer).toContain("Best for: living.");
    expect(response.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: "Missing maintenance fee makes ownership cost incomplete.",
          kind: "risk",
          propertyId: "property-1"
        })
      ])
    );
  });

  it("continues property detail answers when optional enrichments fail", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const advisor = {
      summarize: vi.fn().mockRejectedValue(new Error("advisor unavailable"))
    };
    const neighborhood = {
      analyze: vi.fn().mockRejectedValue(new Error("neighborhood unavailable"))
    };
    const service = serviceFactory({
      advisor,
      neighborhood,
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      locale: "en",
      message: "Is this a good investment near cafes?",
      propertyId: "property-1"
    });

    expect(advisor.summarize).toHaveBeenCalledTimes(1);
    expect(neighborhood.analyze).toHaveBeenCalledWith("tenant-1", "property-1");
    expect(response.answer).toContain("Wongamat Sea View Residence is a 1-bedroom condo");
    expect(response.citations).toEqual(expect.not.arrayContaining([expect.objectContaining({ source: "advisor" })]));
    expect(response.citations).toEqual(expect.not.arrayContaining([expect.objectContaining({ source: "neighborhood" })]));
    expect(warn).toHaveBeenCalledWith(
      "AI chat advisor summary failed for tenant tenant-1, property property-1: advisor unavailable"
    );
    expect(warn).toHaveBeenCalledWith(
      "AI chat neighborhood enrichment failed for tenant tenant-1, property property-1: neighborhood unavailable"
    );
  });

  it("continues search answers when due diligence enrichment fails", async () => {
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK = "true";
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const advisor = {
      summarize: vi.fn().mockRejectedValue(new Error("advisor unavailable"))
    };
    const property = propertyFactory();
    const service = serviceFactory({
      advisor,
      searchItems: [property],
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      }
    });

    const response = await service.ask("tenant-1", {
      locale: "en",
      message: "Find condos in Pattaya"
    });

    expect(advisor.summarize).toHaveBeenCalledWith("tenant-1", "property-1");
    expect(response.answer).toContain("I found 1 matching listing.");
    expect(response.answer).toContain("Wongamat Sea View Residence");
    expect(response.insights).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      "AI chat due diligence retrieval failed for tenant tenant-1: advisor unavailable"
    );
  });

  it("asks to clarify the listing when a viewing follow-up has no previous recommendation context", async () => {
    const service = serviceFactory({
      textGenerator: {
        isConfigured: vi.fn().mockReturnValue(false),
        generate: vi.fn()
      },
      searchItems: [
        propertyFactory({
          id: "property-new-search",
          title: "New Search Result Condo"
        })
      ]
    });

    const response = await service.ask("tenant-1", {
      locale: "en",
      message: "May I see it?"
    });

    expect(response.answer).toContain("Which listing would you like to view?");
    expect(response.matchedPropertyIds).toEqual([]);
    expect(response.suggestedActions).toContain("ask-visitor-to-pick-listing");
  });

  it("generates through Gemini when Gemini is selected as the provider", async () => {
    process.env.AI_DEFAULT_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GEMINI_CHAT_MODEL = "gemini-test-model";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "Gemini grounded answer." }]
              }
            }
          ]
        }),
        { status: 200 }
      )
    );
    const generator = new OpenAiTextGenerator();

    const result = await generator.generate({
      citations: [{ label: "Wongamat Sea View Residence", propertyId: "property-1", source: "property" }],
      context: "Property: Wongamat Sea View Residence",
      locale: "ru",
      message: "Подбери кондо с видом на море",
      persona: {
        gender: "feminine",
        leadQualificationFields: ["budget", "preferredArea", "financing", "whatsapp"],
        name: "Anna",
        tone: "friendly",
        welcomeMessage: "Hi! I'm Anna, your AI property consultant."
      }
    });

    expect(result).toEqual({
      answer: "Gemini grounded answer.",
      provider: "gemini",
      model: "gemini-test-model"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1beta/models/gemini-test-model:generateContent?key=gemini-key"),
      expect.objectContaining({
        method: "POST"
      })
    );
    const [, requestInit] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String(requestInit?.body)) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
      generationConfig: { maxOutputTokens: number };
    };
    expect(body.generationConfig.maxOutputTokens).toBe(1400);
    const prompt = body.contents[0]?.parts[0]?.text ?? "";
    expect(prompt).toContain('Your public concierge name is "Anna".');
    expect(prompt).toContain("Use a friendly tone.");
    expect(prompt).toContain("Write 2-4 informative sentences for normal listing answers");
    expect(prompt).toContain("Do not end mid-sentence.");
    expect(prompt).toContain("Lead qualification fields to collect naturally when relevant: budget, preferred area, financing or mortgage needs, WhatsApp.");
    expect(prompt).toContain("Ask at most one concise follow-up question at a time");
    expect(prompt).toContain("Do not repeat the tenant welcome message or reintroduce yourself after the first greeting");
    expect(prompt).toContain("Use feminine first-person wording");
    expect(prompt).toContain('use first-person feminine forms such as "я нашла", "я подобрала", "я проверила"');
    expect(prompt).toContain('never use masculine forms such as "я нашел" or "я подобрал"');
    expect(prompt).toContain("Do not print bracketed citation markers like [1], [2]");
    expect(prompt).toContain("If short-term rent, minimum stay, or contract term facts appear in context");
  });
});

function serviceFactory(overrides: {
  advisor?: {
    summarize: ReturnType<typeof vi.fn>;
  };
  naturalLanguageSearch?: {
    interpret: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
  };
  neighborhood?: {
    analyze: ReturnType<typeof vi.fn>;
  };
  knowledge?: {
    searchChunks: ReturnType<typeof vi.fn>;
  };
  locationIntelligence?: LocationIntelligenceService;
  properties?: {
    findById: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
  };
  textGenerator: AiTextGenerator;
  searchItems?: PropertySnapshot[];
  knowledgeItems?: KnowledgeDocumentChunkSnapshot[];
}): AiChatService {
  const properties = overrides.properties ?? {
    findById: vi.fn().mockResolvedValue(propertyFactory()),
    search: vi.fn().mockResolvedValue(overrides.searchItems ?? [])
  };
  const advisor = overrides.advisor ?? {
    summarize: vi.fn().mockImplementation((_tenantId: string, propertyId: string) =>
      Promise.resolve({
        bestFor: ["living"],
        confidence: "medium",
        cons: [],
        generatedFrom: [
          "property-price",
          "property-location",
          "property-size",
          "amenities",
          "rent-estimate",
          "maintenance-fee"
        ],
        propertyId,
        pros: ["Sea view can support stronger resale and rental positioning."],
        questionsToAskAgent: [
          "What is the exact foreign quota status for this unit?",
          "What are the current common area fees and sinking fund terms?",
          "Are short-term rentals allowed by the building rules?"
        ],
        risks: [
          "Missing rent estimate makes investment yield uncertain.",
          "Missing maintenance fee makes ownership cost incomplete."
        ]
      })
    )
  };
  const naturalLanguageSearch = overrides.naturalLanguageSearch ?? {
    interpret: vi.fn().mockReturnValue({
      filters: {},
      interpretedIntent: "Pattaya condo search",
      rankingExplanation: "Indexed tenant listings ranked by relevance."
    }),
    search: vi.fn().mockResolvedValue({
      filters: {},
      interpretedIntent: "Pattaya condo search",
      items: overrides.searchItems ?? [],
      rankingExplanation: "Indexed tenant listings ranked by relevance.",
      total: overrides.searchItems?.length ?? 0
    })
  };
  const neighborhood = overrides.neighborhood ?? {
    analyze: vi.fn()
  };
  const knowledge = overrides.knowledge ?? {
    searchChunks: vi.fn().mockResolvedValue({
      items: overrides.knowledgeItems ?? [],
      total: overrides.knowledgeItems?.length ?? 0
    })
  };

  return new AiChatService(
    properties as never,
    advisor as never,
    naturalLanguageSearch as never,
    neighborhood as never,
    knowledge as never,
    overrides.textGenerator,
    overrides.locationIntelligence
  );
}

function propertyFactory(overrides: Partial<PropertySnapshot> = {}): PropertySnapshot {
  return {
    amenities: ["sea-view", "pool", "fast-internet"],
    areaSqm: 45,
    bathrooms: 1,
    beachDistanceMeters: 240,
    bedrooms: 1,
    createdAt: "2026-07-21T00:00:00.000Z",
    id: "property-1",
    kind: "condo",
    listingType: "sale",
    location: {
      latitude: 12.95,
      longitude: 100.88
    },
    market: "pattaya",
    price: {
      amount: 3_500_000,
      currency: "THB"
    },
    status: "available",
    tenantId: "tenant-1",
    title: "Wongamat Sea View Residence",
    updatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides
  };
}

function knowledgeChunkFactory(overrides: Partial<KnowledgeDocumentChunkSnapshot> = {}): KnowledgeDocumentChunkSnapshot {
  return {
    chunkIndex: 0,
    content: "Foreign ownership process and transfer fee guidance for Thailand condo buyers.",
    createdAt: "2026-07-21T00:00:00.000Z",
    documentId: "knowledge-1",
    embeddingStatus: "embedded",
    id: "chunk-1",
    kind: "legal",
    locale: "en",
    score: 0.88,
    tags: ["starter"],
    title: "Buying guide",
    tokenEstimate: 12,
    tenantId: "tenant-1",
    updatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides
  };
}
