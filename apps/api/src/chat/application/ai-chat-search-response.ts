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
  const asksForRemoteWork =
    lifestyleSignals.has("remote-work") ||
    /\b(remote|freelance|freelancer|digital nomad|internet|coworking)\b|удален|фриланс|интернет|коворкинг|ออนไลน์|远程|遠程|自由职业|自由職業|数字游民|數字遊民/i.test(
      normalized
    );
  const asksForNightlife =
    lifestyleSignals.has("nightlife") ||
    /\b(nightlife|adults only|adult only|party|bar|bars|club|clubs|entertainment|walking street|boyz town)\b|ночн|бар|клуб|тусов|развлеч|夜生活|娱乐|娛樂/i.test(
      normalized
    );
  const asksForRetiree =
    lifestyleSignals.has("retiree-comfort") ||
    /\b(retiree|retired|retirement|senior|elderly)\b|пенсионер|пенси[ию]|пожил|เกษียณ|退休|养老|養老|老年/i.test(normalized);
  const asksForWinterStay =
    lifestyleSignals.has("winter-stay") ||
    /\b(winter|wintering|snowbird|long stay|long-stay)\b|зимовк|зимовать|зиму|ระยะยาว|过冬|過冬|避寒/i.test(normalized);

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

  if (asksForRemoteWork) {
    const remoteReadyCount = options.matches.filter((property) =>
      hasAmenity(property, ["fast-internet", "fiber-internet", "high-speed internet", "coworking", "coworking space", "workspace"])
    ).length;

    return `For remote work or freelancing, I am prioritizing internet/coworking signals and usable space: ${remoteReadyCount} of the shown options include a remote-work amenity signal in the imported facts. Please verify actual internet provider, speed, and desk setup before committing.`;
  }

  if (asksForNightlife) {
    const nightlifeCount = options.matches.filter((property) =>
      /central|walking street|boyz town|nightlife|bar|club|entertainment|pattaya beach/i.test(
        `${property.title} ${property.address ?? ""} ${property.amenities.join(" ")}`
      )
    ).length;

    return `For an adults-only nightlife stay, I am prioritizing central entertainment access and late-night convenience: ${nightlifeCount} of the shown options have an explicit nightlife or central-area signal. Please verify guest policy, noise level, and building rules before booking.`;
  }

  if (asksForRetiree) {
    const comfortCount = options.matches.filter((property) =>
      hasAmenity(property, ["elevator", "lift", "24h security", "security", "covered parking", "shuttle service", "garden", "pool"])
    ).length;

    return `For retirement or senior living, I am prioritizing daily comfort, security, and easy building access: ${comfortCount} of the shown options include comfort or accessibility signals. Please confirm elevator reliability, medical access, transport, and noise level with the agent.`;
  }

  if (asksForWinterStay) {
    const longStayCount = options.matches.filter((property) =>
      hasAmenity(property, ["washing machine", "balcony", "pool", "gym", "fast-internet", "fiber-internet", "high-speed internet"])
    ).length;

    return `For a winter or long-stay setup, I am prioritizing practical day-to-day amenities: ${longStayCount} of the shown options include long-stay signals such as laundry, balcony, pool/gym, or stronger internet. Please confirm utility costs and contract length.`;
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
