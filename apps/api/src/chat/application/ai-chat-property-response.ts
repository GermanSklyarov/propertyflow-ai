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
}): AiChatResponseDraft {
  const citations: AiChatCitation[] = [propertyCitation(options.property)];
  const answerParts = [describeProperty(options.property)];

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
