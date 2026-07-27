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
    const property = propertyFactory();
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

    const response = await service.ask("tenant-1", {
      locale: "en",
      message: "I need a sea-view condo under 5M in Pattaya"
    });

    expect(response.answer).toBe("A real model answer grounded in Wongamat Sea View Residence and the buying guide.");
    expect(response.generation).toEqual({
      mode: "llm",
      provider: "openai",
      model: "configured-model"
    });
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en",
        message: "I need a sea-view condo under 5M in Pattaya",
        context: expect.stringContaining("Wongamat Sea View Residence")
      })
    );
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining("Foreign ownership process")
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
    expect(response.generation).toMatchObject({
      mode: "deterministic-fallback"
    });
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
      locale: "en",
      message: "Do you have sea-view condos?"
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
  });
});

function serviceFactory(overrides: {
  textGenerator: AiTextGenerator;
  searchItems?: PropertySnapshot[];
  knowledgeItems?: KnowledgeDocumentChunkSnapshot[];
}): AiChatService {
  const properties = {
    findById: vi.fn().mockResolvedValue(propertyFactory()),
    search: vi.fn().mockResolvedValue(overrides.searchItems ?? [])
  };
  const advisor = {
    summarize: vi.fn()
  };
  const naturalLanguageSearch = {
    interpret: vi.fn().mockReturnValue({
      filters: {},
      interpretedIntent: "Pattaya condo search",
      rankingExplanation: "Indexed tenant listings ranked by relevance."
    }),
    search: vi.fn().mockResolvedValue({
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
