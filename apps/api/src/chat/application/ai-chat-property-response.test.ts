import { describe, expect, it } from "vitest";
import type {
  AiAdvisorSummary,
  KnowledgeDocumentChunkSnapshot,
  NeighborhoodIntelligence
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { buildAiChatPropertyResponseDraft } from "./ai-chat-property-response.js";
import { classifyAiChatIntent } from "./ai-chat-intent.js";

describe("ai-chat-property-response", () => {
  it("builds a property detail draft with listing evidence and default actions", () => {
    const draft = buildAiChatPropertyResponseDraft({
      dueDiligence: {
        contextLines: ["Structured due diligence context"],
        insights: []
      },
      intent: classifyAiChatIntent("Tell me more about this listing"),
      knowledge: [],
      property: propertyFactory()
    });

    expect(draft.deterministicDraft).toContain("Wongamat Sea View Residence is a 1-bedroom condo");
    expect(draft.context).toContain("Structured listing evidence");
    expect(draft.context).toContain("Structured due diligence context");
    expect(draft.citations).toEqual([expect.objectContaining({ propertyId: "property-1", source: "property" })]);
    expect(draft.matchedPropertyIds).toEqual(["property-1"]);
    expect(draft.suggestedActions).toEqual(["compare-similar-properties", "open-investment-calculator", "create-lead"]);
  });

  it("builds a viewing handoff draft for booking requests", () => {
    const draft = buildAiChatPropertyResponseDraft({
      dueDiligence: {
        contextLines: [],
        insights: []
      },
      intent: classifyAiChatIntent("May I view this listing tomorrow at 3 pm?"),
      knowledge: [],
      property: propertyFactory(),
      requestMessage: "May I view this listing tomorrow at 3 pm?"
    });

    expect(draft.deterministicDraft).toContain("I can help arrange a viewing of Wongamat Sea View Residence for tomorrow at 3 pm");
    expect(draft.deterministicDraft).toContain("Please share your WhatsApp, Telegram, phone, or email");
  });

  it("adds neighborhood, advisor, and knowledge context only when requested and supplied", () => {
    const draft = buildAiChatPropertyResponseDraft({
      advisorSummary: advisorSummaryFactory(),
      dueDiligence: {
        contextLines: [],
        insights: []
      },
      intent: classifyAiChatIntent("Is this condo a good investment and what about the neighborhood?"),
      knowledge: [knowledgeChunkFactory()],
      neighborhood: neighborhoodFactory(),
      property: propertyFactory()
    });

    expect(draft.deterministicDraft).toContain("Best for: living, investment.");
    expect(draft.deterministicDraft).toContain("Pros: Sea view can support stronger resale.");
    expect(draft.deterministicDraft).toContain("Watch-outs: Low floor may reduce view appeal.");
    expect(draft.deterministicDraft).toContain("Walkable Wongamat area with cafes nearby.");
    expect(draft.deterministicDraft).toContain("Relevant knowledge: Buying Guide");
    expect(draft.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "advisor", label: "AI advisor, confidence high" }),
        expect.objectContaining({ source: "neighborhood", label: "Neighborhood intelligence, walkability 4.4/5" }),
        expect.objectContaining({ source: "knowledge", documentId: "document-1" })
      ])
    );
  });
});

function advisorSummaryFactory(overrides: Partial<AiAdvisorSummary> = {}): AiAdvisorSummary {
  return {
    bestFor: ["living", "investment"],
    confidence: "high",
    cons: ["Low floor may reduce view appeal."],
    generatedFrom: ["property-price", "property-location"],
    propertyId: "property-1",
    pros: ["Sea view can support stronger resale."],
    questionsToAskAgent: [],
    risks: [],
    ...overrides
  };
}

function neighborhoodFactory(overrides: Partial<NeighborhoodIntelligence> = {}): NeighborhoodIntelligence {
  return {
    market: "pattaya",
    nearestPois: [],
    propertyId: "property-1",
    scores: [],
    signals: ["cafes", "beach-life"],
    summary: "Walkable Wongamat area with cafes nearby.",
    walkabilityScore: 4.4,
    ...overrides
  };
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
    documentId: "document-1",
    embeddingStatus: "embedded",
    id: "chunk-1",
    kind: "legal",
    locale: "en",
    score: 0.91,
    tags: [],
    tenantId: "tenant-1",
    title: "Buying Guide",
    tokenEstimate: 42,
    updatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides
  };
}
