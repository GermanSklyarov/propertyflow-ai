import type {
  AiChatCitation,
  AiChatInsight,
  KnowledgeDocumentChunkSnapshot,
  NaturalLanguagePropertySearchResponse
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { buildAiChatContext, buildListingEvidence, knowledgeCitation, knowledgeLine, propertyCitation, shortPropertyLine } from "./ai-chat-context.js";
import type { AiChatDueDiligencePayload } from "./ai-chat-due-diligence.js";

export interface AiChatResponseDraft {
  citations: AiChatCitation[];
  context: string;
  deterministicDraft: string;
  insights: AiChatInsight[];
  matchedPropertyIds: string[];
  suggestedActions: string[];
}

export function buildAiChatSearchResponseDraft(options: {
  dueDiligence: AiChatDueDiligencePayload;
  items: PropertySnapshot[];
  knowledge: KnowledgeDocumentChunkSnapshot[];
  matches: PropertySnapshot[];
  requestMessage?: string;
  search: NaturalLanguagePropertySearchResponse;
}): AiChatResponseDraft {
  return options.matches.length ? buildMatchedSearchDraft(options) : buildNoMatchSearchDraft(options);
}

function buildNoMatchSearchDraft(options: {
  knowledge: KnowledgeDocumentChunkSnapshot[];
  search: NaturalLanguagePropertySearchResponse;
}): AiChatResponseDraft {
  const citations: AiChatCitation[] = [
    { source: "search", label: options.search.rankingExplanation },
    ...options.knowledge.map((chunk) => knowledgeCitation(chunk))
  ];
  const insights: AiChatInsight[] = [
    {
      kind: "handoff",
      title: "No exact listing match",
      detail: "Offer to broaden filters or hand the request to an agent for off-market options.",
      severity: "warning"
    }
  ];

  if (options.knowledge.length) {
    insights.push({
      kind: "knowledge",
      title: "Knowledge context available",
      detail: "Use the cited knowledge sources to answer the client while listing inventory is missing.",
      severity: "info"
    });
  }

  return {
    citations,
    context: buildAiChatContext(
      options.knowledge.length
        ? ["No matching listings were found.", ...options.knowledge.map((chunk) => knowledgeLine(chunk))]
        : ["No matching listings or knowledge chunks were found."],
      citations
    ),
    deterministicDraft: options.knowledge.length
      ? `I could not find matching listings yet, but I found relevant knowledge: ${options.knowledge.map((chunk) => knowledgeLine(chunk)).join(" ")}`
      : "I could not find matching listings in this tenant workspace yet. Try broadening the market, budget, or beach-distance requirements.",
    insights,
    matchedPropertyIds: [],
    suggestedActions: ["relax-filters", "ask-agent-for-off-market-options"]
  };
}

function buildMatchedSearchDraft(options: {
  dueDiligence: AiChatDueDiligencePayload;
  items: PropertySnapshot[];
  knowledge: KnowledgeDocumentChunkSnapshot[];
  matches: PropertySnapshot[];
  requestMessage?: string;
  search: NaturalLanguagePropertySearchResponse;
}): AiChatResponseDraft {
  const suitabilityExplanation = buildSearchSuitabilityExplanation({
    matches: options.matches,
    requestMessage: options.requestMessage,
    search: options.search
  });
  const answer = [
    `I found ${options.items.length} matching listing${options.items.length === 1 ? "" : "s"}.`,
    `Top matches: ${options.matches.map((property) => shortPropertyLine(property)).join(" ")}`,
    suitabilityExplanation,
    searchExplanation(options.search),
    options.knowledge.length
      ? `Relevant knowledge: ${options.knowledge.map((chunk) => knowledgeLine(chunk)).join(" ")}`
      : ""
  ].join(" ");
  const citations: AiChatCitation[] = [
    { source: "search", label: options.search.interpretedIntent },
    ...options.matches.map((property) => propertyCitation(property)),
    ...options.knowledge.map((chunk) => knowledgeCitation(chunk))
  ];

  return {
    citations,
    context: buildAiChatContext(
      [answer, ...buildListingEvidence(options.matches), ...options.dueDiligence.contextLines],
      citations
    ),
    deterministicDraft: answer,
    insights: options.dueDiligence.insights,
    matchedPropertyIds: options.items.slice(0, 24).map((property) => property.id),
    suggestedActions: ["compare-results", "open-map", "save-search"]
  };
}

function searchExplanation(search: NaturalLanguagePropertySearchResponse): string {
  if (search.items.length || search.rankingExplanation.includes("unavailable")) {
    return search.rankingExplanation;
  }

  return "The indexed search returned no hits, so I used the structured PostgreSQL filters as a fallback.";
}

function buildSearchSuitabilityExplanation(options: {
  matches: PropertySnapshot[];
  requestMessage?: string;
  search: NaturalLanguagePropertySearchResponse;
}): string | undefined {
  const normalized = options.requestMessage?.toLowerCase() ?? "";
  const requiredAmenities = new Set(options.search.filters.requiredAmenities ?? []);
  const lifestyleSignals = new Set(options.search.filters.lifestyleSignals ?? []);
  const asksForPets =
    requiredAmenities.has("pet-friendly") ||
    lifestyleSignals.has("pet-friendly") ||
    /\b(pet|pets|dog|dogs|cat|cats)\b|питом|собак|кош|สัตว์เลี้ยง|หมา|แมว|宠物|寵物|狗|猫|貓/i.test(normalized);

  if (asksForPets) {
    const petConfirmedCount = options.matches.filter((property) => hasAmenity(property, ["pet-friendly", "pets-allowed"])).length;
    const spaciousMatches = options.matches.filter((property) => property.bedrooms >= 2 || property.areaSqm >= 60).length;
    const propertyKinds = summarizeDistinctValues(options.matches.map((property) => property.kind));
    const spaceNote = spaciousMatches
      ? `${spaciousMatches} of the shown options have 2+ bedrooms or at least 60 sqm, which is more practical for living with pets`
      : "the shown options are the closest matches, but their space should be checked carefully for pets";
    const petSignalNote = petConfirmedCount
      ? `${petConfirmedCount} of the shown options include a pet-friendly signal in the imported listing facts`
      : "I do not see a confirmed pet-friendly signal on the shown options, so the agent must verify building rules before you rely on them";

    return `I am prioritizing the pet requirement: ${petSignalNote}; ${spaceNote}${propertyKinds ? `; property types shown: ${propertyKinds}` : ""}. For two dogs, please confirm current building pet rules, breed/size limits, and any pet deposit before booking.`;
  }

  return undefined;
}

function hasAmenity(property: PropertySnapshot, amenities: string[]) {
  const propertyAmenities = new Set(property.amenities.map((amenity) => amenity.toLowerCase()));

  return amenities.some((amenity) => propertyAmenities.has(amenity));
}

function summarizeDistinctValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, 3).join(", ");
}
