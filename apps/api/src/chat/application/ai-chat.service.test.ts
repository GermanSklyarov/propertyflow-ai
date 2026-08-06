import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { KnowledgeDocumentChunkSnapshot } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { AiChatService } from "./ai-chat.service.js";
import { OpenAiTextGenerator, type AiTextGenerator } from "./ai-text-generator.js";

describe("AiChatService", () => {
  afterEach(() => {
    delete process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK;
    delete process.env.AI_DEFAULT_PROVIDER;
    delete process.env.AI_CHAT_MODEL;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_CHAT_MODEL;
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
    };
    const prompt = body.contents[0]?.parts[0]?.text ?? "";
    expect(prompt).toContain('Your public concierge name is "Anna".');
    expect(prompt).toContain("Use a friendly tone.");
    expect(prompt).toContain("Lead qualification fields to collect naturally when relevant: budget, preferred area, financing or mortgage needs, WhatsApp.");
    expect(prompt).toContain("Ask at most one concise follow-up question at a time");
    expect(prompt).toContain("Do not repeat the tenant welcome message or reintroduce yourself after the first greeting");
    expect(prompt).toContain("Use feminine first-person wording");
    expect(prompt).toContain('use first-person feminine forms such as "я нашла", "я подобрала", "я проверила"');
    expect(prompt).toContain('never use masculine forms such as "я нашел" or "я подобрал"');
    expect(prompt).toContain("Do not print bracketed citation markers like [1], [2]");
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
  const neighborhood = {
    analyze: vi.fn()
  };
  const knowledge = {
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
    overrides.textGenerator
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
