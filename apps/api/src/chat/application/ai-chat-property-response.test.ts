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

  it("treats rental availability dates as handoff requests", () => {
    const draft = buildAiChatPropertyResponseDraft({
      dueDiligence: {
        contextLines: [],
        insights: []
      },
      intent: classifyAiChatIntent("I want to rent on 1st september it's possible?"),
      knowledge: [],
      property: propertyFactory({
        listingType: "rent",
        rentalPriceMonthly: { amount: 24_000, currency: "THB" }
      }),
      requestMessage: "I want to rent on 1st september it's possible?"
    });

    expect(draft.deterministicDraft).toContain("I can help arrange a viewing of Wongamat Sea View Residence for 1st september");
    expect(draft.deterministicDraft).toContain("Rental ask is 24000 THB/mo");
  });

  it("keeps Russian purchase viewing handoffs out of rental prompts when the listing also has rent data", () => {
    const draft = buildAiChatPropertyResponseDraft({
      conversation: [
        {
          role: "user",
          text: "хочу купить кондо в паттайе с бассейном для релокации, бюджет до 5млн"
        },
        {
          role: "assistant",
          text: "Wongamat Sea View Residence находится ближе всего к пляжу."
        }
      ],
      dueDiligence: {
        contextLines: [],
        insights: []
      },
      intent: classifyAiChatIntent("отлично мне подходит, можно посмотреть?"),
      knowledge: [],
      locale: "ru",
      property: propertyFactory({
        listingType: "sale_or_rent",
        rentalPriceMonthly: { amount: 28_000, currency: "THB" }
      }),
      requestMessage: "отлично мне подходит, можно посмотреть?"
    });

    expect(draft.deterministicDraft).toContain("Если планируете покупку");
    expect(draft.deterministicDraft).not.toContain("Дата въезда");
    expect(draft.deterministicDraft).not.toContain("срок контракта");
    expect(draft.deterministicDraft).not.toContain("Арендная ставка");
  });

  it("localizes viewing handoff drafts for Thai and Chinese", () => {
    const thaiDraft = buildAiChatPropertyResponseDraft({
      dueDiligence: {
        contextLines: [],
        insights: []
      },
      intent: classifyAiChatIntent("ขอนัดดูห้อง"),
      knowledge: [],
      locale: "th",
      property: propertyFactory({
        listingType: "rent",
        rentalPriceMonthly: { amount: 19_000, currency: "THB" }
      }),
      requestMessage: "ขอนัดดูห้อง"
    });
    const chineseDraft = buildAiChatPropertyResponseDraft({
      dueDiligence: {
        contextLines: [],
        insights: []
      },
      intent: classifyAiChatIntent("怎么预约看房？"),
      knowledge: [],
      locale: "zh",
      property: propertyFactory({
        listingType: "rent",
        rentalPriceMonthly: { amount: 19_000, currency: "THB" }
      }),
      requestMessage: "怎么预约看房？"
    });

    expect(thaiDraft.deterministicDraft).toContain("ฉันช่วยนัดชม Wongamat Sea View Residence");
    expect(thaiDraft.deterministicDraft).toContain("ค่าเช่า 19000 THB/เดือน");
    expect(thaiDraft.deterministicDraft).not.toContain("Great choice");
    expect(chineseDraft.deterministicDraft).toContain("我可以帮你预约看 Wongamat Sea View Residence");
    expect(chineseDraft.deterministicDraft).toContain("租金为 19000 THB/月");
    expect(chineseDraft.deterministicDraft).not.toContain("Great choice");
  });

  it("answers family and pet suitability questions instead of repeating the listing description", () => {
    const familyDraft = buildAiChatPropertyResponseDraft({
      dueDiligence: {
        contextLines: [],
        insights: []
      },
      intent: classifyAiChatIntent("Can I live there with kids?"),
      knowledge: [],
      property: propertyFactory({ areaSqm: 45, bedrooms: 1, title: "Central Pattaya Rental Loft" }),
      requestMessage: "Can I live there with kids?"
    });
    const petDraft = buildAiChatPropertyResponseDraft({
      dueDiligence: {
        contextLines: [],
        insights: []
      },
      intent: classifyAiChatIntent("Can I live there with pets?"),
      knowledge: [],
      property: propertyFactory({
        amenities: ["pool", "gym"],
        rentalPriceMonthly: { amount: 24_000, currency: "THB" },
        title: "Central Pattaya Rental Loft"
      }),
      requestMessage: "Can I live there with pets?"
    });

    expect(familyDraft.deterministicDraft).toContain("can be considered for living with kids");
    expect(familyDraft.deterministicDraft).toContain("more suitable for one adult, a couple, or a small family");
    expect(petDraft.deterministicDraft).toContain("I do not see pet-friendly or pets-allowed confirmed");
    expect(petDraft.deterministicDraft).toContain("verify the building rules for dogs or cats");
    expect(petDraft.deterministicDraft).not.toContain("Central Pattaya Rental Loft is a 1-bedroom condo");
  });

  it("answers localized amenity follow-ups instead of repeating a dry listing summary", () => {
    const draft = buildAiChatPropertyResponseDraft({
      dueDiligence: {
        contextLines: [],
        insights: []
      },
      intent: classifyAiChatIntent("а у второго варианта есть спортзал?"),
      knowledge: [],
      locale: "ru",
      property: propertyFactory({
        amenities: ["pool", "kids room", "parking"],
        bedrooms: 2,
        title: "Jomtien Family Corner Condo"
      }),
      requestMessage: "а у второго варианта есть спортзал?"
    });

    expect(draft.deterministicDraft).toContain("У Jomtien Family Corner Condo в данных объекта не указано: спортзал");
    expect(draft.deterministicDraft).toContain("Из удобств указаны: бассейн");
    expect(draft.deterministicDraft).not.toContain("is a 2-bedroom condo");
  });

  it("recognizes popular Russian amenity synonyms in property follow-ups", () => {
    const property = propertyFactory({
      amenities: ["24h security", "air-conditioning", "washing machine", "fiber-internet"],
      title: "Jomtien Family Corner Condo"
    });
    const securityDraft = buildAiChatPropertyResponseDraft({
      dueDiligence: {
        contextLines: [],
        insights: []
      },
      intent: classifyAiChatIntent("там есть охрана?"),
      knowledge: [],
      locale: "ru",
      property,
      requestMessage: "там есть охрана?"
    });
    const airconDraft = buildAiChatPropertyResponseDraft({
      dueDiligence: {
        contextLines: [],
        insights: []
      },
      intent: classifyAiChatIntent("а кондиционер есть?"),
      knowledge: [],
      locale: "ru",
      property,
      requestMessage: "а кондиционер есть?"
    });
    const washerDraft = buildAiChatPropertyResponseDraft({
      dueDiligence: {
        contextLines: [],
        insights: []
      },
      intent: classifyAiChatIntent("есть стиральная машина?"),
      knowledge: [],
      locale: "ru",
      property,
      requestMessage: "есть стиральная машина?"
    });

    expect(securityDraft.deterministicDraft).toContain("у Jomtien Family Corner Condo в данных объекта есть охрана");
    expect(airconDraft.deterministicDraft).toContain("у Jomtien Family Corner Condo в данных объекта есть кондиционер");
    expect(washerDraft.deterministicDraft).toContain("у Jomtien Family Corner Condo в данных объекта есть стиральная машина");
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
