import type {
  AiAdvisorSummary,
  AiChatCitation,
  KnowledgeDocumentChunkSnapshot,
  NeighborhoodIntelligence
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import {
  buildAiChatContext,
  buildListingEvidence,
  describeProperty,
  knowledgeCitation,
  knowledgeLine,
  propertyCitation
} from "./ai-chat-context.js";
import type { AiChatDueDiligencePayload } from "./ai-chat-due-diligence.js";
import type { AiChatIntent } from "./ai-chat-intent.js";
import type { AiChatResponseDraft } from "./ai-chat-search-response.js";

export function buildAiChatPropertyResponseDraft(options: {
  advisorSummary?: AiAdvisorSummary;
  dueDiligence: AiChatDueDiligencePayload;
  intent: AiChatIntent;
  knowledge: KnowledgeDocumentChunkSnapshot[];
  neighborhood?: NeighborhoodIntelligence;
  property: PropertySnapshot;
  requestMessage?: string;
}): AiChatResponseDraft {
  const citations: AiChatCitation[] = [propertyCitation(options.property)];
  const suitabilityAnswer = buildSuitabilityAnswer(options.property, options.requestMessage);
  const answerParts = [
    options.intent.wantsViewing
      ? buildViewingHandoffAnswer(options.property, options.requestMessage)
      : suitabilityAnswer ?? describeProperty(options.property)
  ];

  if (options.intent.includeNeighborhood && options.neighborhood) {
    citations.push({
      source: "neighborhood",
      propertyId: options.property.id,
      title: options.property.title,
      label: `Neighborhood intelligence, walkability ${options.neighborhood.walkabilityScore}/5`
    });
    answerParts.push(options.neighborhood.summary);
  }

  if (options.intent.includeAdvice && options.advisorSummary) {
    citations.push({
      source: "advisor",
      propertyId: options.property.id,
      title: options.property.title,
      label: `AI advisor, confidence ${options.advisorSummary.confidence}`
    });
    answerParts.push(`Best for: ${options.advisorSummary.bestFor.join(", ")}.`);
    answerParts.push(`Pros: ${options.advisorSummary.pros.slice(0, 3).join(" ")}`);
    if (options.advisorSummary.cons.length) {
      answerParts.push(`Watch-outs: ${options.advisorSummary.cons.slice(0, 2).join(" ")}`);
    }
  }

  if (options.knowledge.length) {
    citations.push(...options.knowledge.map((chunk) => knowledgeCitation(chunk)));
    answerParts.push(`Relevant knowledge: ${options.knowledge.map((chunk) => knowledgeLine(chunk)).join(" ")}`);
  }

  return {
    citations,
    context: buildAiChatContext(
      [...answerParts, ...buildListingEvidence([options.property]), ...options.dueDiligence.contextLines],
      citations
    ),
    deterministicDraft: answerParts.join(" "),
    insights: options.dueDiligence.insights,
    matchedPropertyIds: [options.property.id],
    suggestedActions: ["compare-similar-properties", "open-investment-calculator", "create-lead"]
  };
}

function buildSuitabilityAnswer(property: PropertySnapshot, requestMessage?: string): string | undefined {
  const normalized = requestMessage?.toLowerCase() ?? "";

  if (/\b(pet|pets|dog|cat|dogs|cats)\b|питом|собак|кош|สัตว์เลี้ยง|หมา|แมว|宠物|寵物|狗|猫|貓/i.test(normalized)) {
    const amenities = new Set(property.amenities.map((amenity) => amenity.toLowerCase()));
    const hasPetSignal = amenities.has("pet-friendly") || amenities.has("pets-allowed");
    const space = `${property.areaSqm} sqm, ${property.bedrooms} bedroom${property.bedrooms === 1 ? "" : "s"}`;
    const rent = property.rentalPriceMonthly
      ? ` Rental ask is ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/mo.`
      : "";

    return hasPetSignal
      ? `${property.title} looks suitable to check for pets: the listing has a pet-friendly signal, ${space}, and ${summarizeLocation(property)}. I would still ask the agent to confirm the building's current pet rules before booking.${rent}`
      : `${property.title} may work on budget and location, but I do not see pet-friendly or pets-allowed confirmed in the listing facts. Please ask the agent to verify the building rules for dogs or cats before you rely on this option.${rent}`;
  }

  if (/\b(kid|kids|child|children|family)\b|семь|ребен|дет|ครอบครัว|เด็ก|家庭|孩子/i.test(normalized)) {
    const bedroomNote =
      property.bedrooms <= 1
        ? `It is a ${property.bedrooms}-bedroom, ${property.areaSqm} sqm unit, so it is more suitable for one adult, a couple, or a small family than for a larger family.`
        : `It has ${property.bedrooms} bedrooms and ${property.areaSqm} sqm, which is more comfortable for family living.`;
    const rent = property.rentalPriceMonthly
      ? ` Rental ask is ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/mo.`
      : "";

    return `${property.title} can be considered for living with kids, but check the layout and building rules carefully. ${bedroomNote} ${summarizeLocation(property)}.${rent}`;
  }

  return undefined;
}

function summarizeLocation(property: PropertySnapshot): string {
  return property.beachDistanceMeters === undefined
    ? "beach distance is not specified"
    : `${property.beachDistanceMeters}m from the beach`;
}

function buildViewingHandoffAnswer(property: PropertySnapshot, requestMessage?: string): string {
  const preferredSlot = requestMessage ? extractViewingSlot(requestMessage) : undefined;
  const slotText = preferredSlot ? ` for ${preferredSlot}` : "";
  const rental = property.rentalPriceMonthly
    ? ` Rental ask is ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/mo.`
    : "";
  const qualificationPrompt =
    property.listingType === "rent"
      ? " If you already know your target move-in date and contract length, include those too so the agent can check availability and rate."
      : " If you are buying, please also mention whether ownership would be foreign quota, Thai name, or company, and your approximate purchase timing.";

  return `Great choice. I can help arrange a viewing of ${property.title}${slotText}. I cannot directly confirm the agent's calendar from here, but I can pass this preferred slot to the agency team. Please share your WhatsApp, Telegram, phone, or email so they can confirm the exact time.${qualificationPrompt}${rental}`;
}

function extractViewingSlot(message: string): string | undefined {
  const normalized = message.replace(/\s+/g, " ").trim();
  const patterns = [
    /\b(?:today|tomorrow|day after tomorrow|next week|this weekend|weekend)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?/i,
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?/i,
    /\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?/i,
    /\bin\s+\d+\s+days?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?/i,
    /\b(?:сегодня|завтра|послезавтра|на выходных|в выходные|на следующей неделе)(?:\s+в\s+\d{1,2}(?::\d{2})?)?/i,
    /\b(?:明天|今天|后天|後天|下周|下週|周末|週末)/i
  ];

  return patterns.map((pattern) => normalized.match(pattern)?.[0]).find(Boolean);
}
