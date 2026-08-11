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
  const answerParts = [
    options.intent.wantsViewing
      ? buildViewingHandoffAnswer(options.property, options.requestMessage)
      : describeProperty(options.property)
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

function buildViewingHandoffAnswer(property: PropertySnapshot, requestMessage?: string): string {
  const preferredSlot = requestMessage ? extractViewingSlot(requestMessage) : undefined;
  const slotText = preferredSlot ? ` for ${preferredSlot}` : "";
  const rental = property.rentalPriceMonthly
    ? ` Rental ask is ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/mo.`
    : "";

  return `Great choice. I can help arrange a viewing of ${property.title}${slotText}. I cannot directly confirm the agent's calendar from here, but I can pass this preferred slot to the agency team. Please share your WhatsApp, Telegram, phone, or email so they can confirm the exact time.${rental}`;
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
