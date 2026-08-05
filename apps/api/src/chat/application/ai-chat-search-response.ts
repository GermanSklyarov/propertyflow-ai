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
  search: NaturalLanguagePropertySearchResponse;
}): AiChatResponseDraft {
  const answer = [
    `I found ${options.items.length} matching listing${options.items.length === 1 ? "" : "s"}.`,
    `Top matches: ${options.matches.map((property) => shortPropertyLine(property)).join(" ")}`,
    options.search.items.length
      ? options.search.rankingExplanation
      : "The indexed search returned no hits, so I used the structured PostgreSQL filters as a fallback.",
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
    matchedPropertyIds: options.matches.map((property) => property.id),
    suggestedActions: ["compare-results", "open-map", "save-search"]
  };
}
