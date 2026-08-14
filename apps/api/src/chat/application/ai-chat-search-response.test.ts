import { describe, expect, it } from "vitest";
import type { KnowledgeDocumentChunkSnapshot, NaturalLanguagePropertySearchResponse } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { buildAiChatSearchResponseDraft } from "./ai-chat-search-response.js";

describe("ai-chat-search-response", () => {
  it("builds a matched listing draft with citations, evidence, and due diligence context", () => {
    const property = propertyFactory();
    const draft = buildAiChatSearchResponseDraft({
      dueDiligence: {
        contextLines: ["Structured due diligence context", "Wongamat Sea View Residence: verify foreign quota."],
        insights: [
          {
            detail: "What is the exact foreign quota status?",
            kind: "due_diligence",
            propertyId: "property-1",
            severity: "info",
            title: "Ask before recommending"
          }
        ]
      },
      items: [property],
      knowledge: [knowledgeChunkFactory()],
      matches: [property],
      search: searchFactory({ items: [property] })
    });

    expect(draft.deterministicDraft).toContain("I found 1 matching listing.");
    expect(draft.deterministicDraft).toContain("Top matches: Wongamat Sea View Residence");
    expect(draft.context).toContain("Structured listing evidence");
    expect(draft.context).toContain("Structured due diligence context");
    expect(draft.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Search for Pattaya condo", source: "search" }),
        expect.objectContaining({ propertyId: "property-1", source: "property" }),
        expect.objectContaining({ documentId: "document-1", source: "knowledge" })
      ])
    );
    expect(draft.matchedPropertyIds).toEqual(["property-1"]);
    expect(draft.suggestedActions).toEqual(["compare-results", "open-map", "save-search"]);
  });

  it("explains when structured fallback supplied matches after indexed search missed", () => {
    const property = propertyFactory();
    const draft = buildAiChatSearchResponseDraft({
      dueDiligence: { contextLines: [], insights: [] },
      items: [property],
      knowledge: [],
      matches: [property],
      search: searchFactory({ items: [] })
    });

    expect(draft.deterministicDraft).toContain(
      "The indexed search returned no hits, so I used the structured PostgreSQL filters as a fallback."
    );
  });

  it("explains when structured fallback supplied matches after indexed search failed", () => {
    const property = propertyFactory();
    const draft = buildAiChatSearchResponseDraft({
      dueDiligence: { contextLines: [], insights: [] },
      items: [property],
      knowledge: [],
      matches: [property],
      search: searchFactory({
        items: [],
        rankingExplanation:
          "Indexed natural-language search was unavailable, so I used structured repository filters as a fallback."
      })
    });

    expect(draft.deterministicDraft).toContain(
      "Indexed natural-language search was unavailable, so I used structured repository filters as a fallback."
    );
  });

  it("explains why pet-friendly recommendations fit living with dogs", () => {
    const petHouse = propertyFactory({
      amenities: ["pet-friendly", "garden", "parking"],
      areaSqm: 120,
      bedrooms: 3,
      kind: "villa",
      title: "Jomtien Pet Garden House"
    });
    const petCondo = propertyFactory({
      amenities: ["pet-friendly", "pool"],
      areaSqm: 65,
      bedrooms: 2,
      id: "property-2",
      kind: "condo",
      title: "Pratumnak Pet Condo"
    });
    const draft = buildAiChatSearchResponseDraft({
      dueDiligence: { contextLines: [], insights: [] },
      items: [petHouse, petCondo],
      knowledge: [],
      matches: [petHouse, petCondo],
      requestMessage: "i need a room in pattaya for living with 2 dogs",
      search: searchFactory({
        filters: {
          market: "pattaya",
          requiredAmenities: ["pet-friendly"],
          lifestyleSignals: ["pet-friendly"]
        },
        items: [petHouse, petCondo]
      })
    });

    expect(draft.deterministicDraft).toContain("I am prioritizing the pet requirement");
    expect(draft.deterministicDraft).toContain("pet-friendly signal");
    expect(draft.deterministicDraft).toContain("2+ bedrooms or at least 60 sqm");
    expect(draft.deterministicDraft).toContain("breed/size limits");
    expect(draft.deterministicDraft).toContain("property types shown: villa, condo");
  });

  it("explains remote-work fit for freelancer and digital nomad searches", () => {
    const remoteReady = propertyFactory({
      amenities: ["fiber-internet", "coworking space", "workspace"],
      title: "Digital Nomad Coworking Condo"
    });
    const draft = buildAiChatSearchResponseDraft({
      dueDiligence: { contextLines: [], insights: [] },
      items: [remoteReady],
      knowledge: [],
      matches: [remoteReady],
      requestMessage: "freelancer digital nomad condo with good internet",
      search: searchFactory({
        filters: {
          lifestyleSignals: ["remote-work"],
          market: "pattaya"
        },
        items: [remoteReady]
      })
    });

    expect(draft.deterministicDraft).toContain("For remote work or freelancing");
    expect(draft.deterministicDraft).toContain("internet/coworking signals");
    expect(draft.deterministicDraft).toContain("verify actual internet provider");
  });

  it("explains adults-only nightlife fit without treating it like a family request", () => {
    const nightlife = propertyFactory({
      address: "Central Pattaya",
      amenities: ["24h security", "covered parking"],
      title: "Central Pattaya Nightlife Studio"
    });
    const draft = buildAiChatSearchResponseDraft({
      dueDiligence: { contextLines: [], insights: [] },
      items: [nightlife],
      knowledge: [],
      matches: [nightlife],
      requestMessage: "adults only studio near nightlife and bars",
      search: searchFactory({
        filters: {
          lifestyleSignals: ["nightlife"],
          market: "pattaya"
        },
        items: [nightlife]
      })
    });

    expect(draft.deterministicDraft).toContain("For an adults-only nightlife stay");
    expect(draft.deterministicDraft).toContain("guest policy");
    expect(draft.deterministicDraft).not.toContain("children");
  });

  it("explains retiree and winter-stay suitability", () => {
    const retiree = propertyFactory({
      amenities: ["elevator", "24h security", "shuttle service", "garden", "pool"],
      title: "Retirement Comfort Condo"
    });
    const winter = propertyFactory({
      amenities: ["washing machine", "balcony", "pool", "gym", "high-speed internet"],
      id: "property-2",
      title: "Winter Long-Stay Condo"
    });
    const retireeDraft = buildAiChatSearchResponseDraft({
      dueDiligence: { contextLines: [], insights: [] },
      items: [retiree],
      knowledge: [],
      matches: [retiree],
      requestMessage: "condo for retired senior living",
      search: searchFactory({
        filters: {
          lifestyleSignals: ["retiree-comfort"],
          market: "pattaya"
        },
        items: [retiree]
      })
    });
    const winterDraft = buildAiChatSearchResponseDraft({
      dueDiligence: { contextLines: [], insights: [] },
      items: [winter],
      knowledge: [],
      matches: [winter],
      requestMessage: "winter long-stay condo",
      search: searchFactory({
        filters: {
          lifestyleSignals: ["winter-stay"],
          market: "pattaya"
        },
        items: [winter]
      })
    });

    expect(retireeDraft.deterministicDraft).toContain("For retirement or senior living");
    expect(retireeDraft.deterministicDraft).toContain("elevator reliability");
    expect(winterDraft.deterministicDraft).toContain("For a winter or long-stay setup");
    expect(winterDraft.deterministicDraft).toContain("utility costs and contract length");
  });

  it("builds no-match guidance with knowledge context when inventory is missing", () => {
    const draft = buildAiChatSearchResponseDraft({
      dueDiligence: { contextLines: [], insights: [] },
      items: [],
      knowledge: [knowledgeChunkFactory()],
      matches: [],
      search: searchFactory({ items: [] })
    });

    expect(draft.deterministicDraft).toContain("I could not find matching listings yet");
    expect(draft.context).toContain("No matching listings were found.");
    expect(draft.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "handoff", title: "No exact listing match" }),
        expect.objectContaining({ kind: "knowledge", title: "Knowledge context available" })
      ])
    );
    expect(draft.matchedPropertyIds).toEqual([]);
    expect(draft.suggestedActions).toEqual(["relax-filters", "ask-agent-for-off-market-options"]);
  });

  it("builds no-match guidance without pretending knowledge exists", () => {
    const draft = buildAiChatSearchResponseDraft({
      dueDiligence: { contextLines: [], insights: [] },
      items: [],
      knowledge: [],
      matches: [],
      search: searchFactory({ items: [] })
    });

    expect(draft.deterministicDraft).toContain("I could not find matching listings in this tenant workspace yet");
    expect(draft.context).toContain("No matching listings or knowledge chunks were found.");
    expect(draft.insights).toEqual([expect.objectContaining({ kind: "handoff" })]);
  });
});

function searchFactory(
  overrides: Partial<NaturalLanguagePropertySearchResponse> = {}
): NaturalLanguagePropertySearchResponse {
  return {
    filters: {},
    interpretedIntent: "Search for Pattaya condo",
    items: [],
    rankingExplanation: "Indexed tenant listings ranked by relevance.",
    total: 0,
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
    monthlyRentEstimate: {
      amount: 28_000,
      currency: "THB"
    },
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
