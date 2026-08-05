import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { AiChatCitation, AiChatInsight, AiChatRequest, AiChatResponse } from "@propertyflow/contracts";
import { KnowledgeDocumentService } from "../../knowledge/application/knowledge-document.service.js";
import { AiPropertyAdvisorService } from "../../properties/application/services/ai-property-advisor.service.js";
import { NaturalLanguagePropertySearchService } from "../../properties/application/services/natural-language-property-search.service.js";
import { NeighborhoodIntelligenceService } from "../../properties/application/services/neighborhood-intelligence.service.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../properties/domain/property.repository.js";
import {
  buildAiChatContext,
  buildConversationContext,
  buildListingEvidence,
  describeProperty,
  knowledgeCitation,
  knowledgeLine,
  propertyCitation,
  shortPropertyLine
} from "./ai-chat-context.js";
import { buildAiChatDueDiligencePayload } from "./ai-chat-due-diligence.js";
import { classifyAiChatIntent } from "./ai-chat-intent.js";
import { planAiChatRetrieval } from "./ai-chat-retrieval-plan.js";
import { AI_TEXT_GENERATOR, type AiConciergePersona, type AiTextGenerator } from "./ai-text-generator.js";

export interface AiChatAskOptions {
  persona?: AiConciergePersona;
}

@Injectable()
export class AiChatService {
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(AiPropertyAdvisorService) private readonly advisor: AiPropertyAdvisorService,
    @Inject(NaturalLanguagePropertySearchService)
    private readonly naturalLanguageSearch: NaturalLanguagePropertySearchService,
    @Inject(NeighborhoodIntelligenceService)
    private readonly neighborhoodIntelligence: NeighborhoodIntelligenceService,
    @Inject(KnowledgeDocumentService) private readonly knowledge: KnowledgeDocumentService,
    @Inject(AI_TEXT_GENERATOR) private readonly textGenerator: AiTextGenerator
  ) {}

  async ask(tenantId: string, request: AiChatRequest, options: AiChatAskOptions = {}): Promise<AiChatResponse> {
    const plan = planAiChatRetrieval(request);

    if (plan.mode === "property-detail") {
      return this.answerAboutProperty(tenantId, { ...request, propertyId: plan.propertyId }, options, plan.intent);
    }

    if (plan.mode === "clarify-reference") {
      return this.answerClarifyPropertyReference(request);
    }

    return this.answerWithSearch(tenantId, request, options);
  }

  private async answerAboutProperty(
    tenantId: string,
    request: AiChatRequest,
    options: AiChatAskOptions,
    intent = classifyAiChatIntent(request.message)
  ): Promise<AiChatResponse> {
    const property = await this.properties.findById(tenantId, request.propertyId!);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const citations: AiChatCitation[] = [propertyCitation(property)];
    const answerParts = [describeProperty(property)];
    const knowledge = await this.retrieveKnowledge(tenantId, request);
    const dueDiligence = await buildAiChatDueDiligencePayload(tenantId, [property], this.advisor);

    if (intent.includeNeighborhood) {
      const neighborhood = await this.neighborhoodIntelligence.analyze(tenantId, property.id);
      citations.push({
        source: "neighborhood",
        propertyId: property.id,
        title: property.title,
        label: `Neighborhood intelligence, walkability ${neighborhood.walkabilityScore}/5`
      });
      answerParts.push(neighborhood.summary);
    }

    if (intent.includeAdvice) {
      const summary = await this.advisor.summarize(tenantId, property.id);
      citations.push({
        source: "advisor",
        propertyId: property.id,
        title: property.title,
        label: `AI advisor, confidence ${summary.confidence}`
      });
      answerParts.push(`Best for: ${summary.bestFor.join(", ")}.`);
      answerParts.push(`Pros: ${summary.pros.slice(0, 3).join(" ")}`);
      if (summary.cons.length) {
        answerParts.push(`Watch-outs: ${summary.cons.slice(0, 2).join(" ")}`);
      }
    }

    if (knowledge.length) {
      citations.push(...knowledge.map((chunk) => knowledgeCitation(chunk)));
      answerParts.push(`Relevant knowledge: ${knowledge.map((chunk) => knowledgeLine(chunk)).join(" ")}`);
    }

    return this.buildResponse(
      request,
      answerParts.join(" "),
      [property.id],
      citations,
      dueDiligence.insights,
      ["compare-similar-properties", "open-investment-calculator", "create-lead"],
      buildAiChatContext([...answerParts, ...buildListingEvidence([property]), ...dueDiligence.contextLines], citations),
      options
    );
  }

  private async answerWithSearch(
    tenantId: string,
    request: AiChatRequest,
    options: AiChatAskOptions
  ): Promise<AiChatResponse> {
    const search = await this.naturalLanguageSearch.search(tenantId, {
      locale: request.locale,
      query: request.message,
      market: request.market,
      purpose: request.purpose
    });
    const interpretation = this.naturalLanguageSearch.interpret({
      locale: request.locale,
      query: request.message,
      market: request.market,
      purpose: request.purpose
    });
    const fallbackItems = search.items.length
      ? []
      : await this.properties.search(tenantId, interpretation.filters);
    const items = search.items.length ? search.items : fallbackItems;
    const matches = items.slice(0, 3);
    const knowledge = await this.retrieveKnowledge(tenantId, request);
    const dueDiligence = await buildAiChatDueDiligencePayload(tenantId, matches, this.advisor);

    if (!matches.length) {
      const noMatchInsights: AiChatInsight[] = [
        {
          kind: "handoff",
          title: "No exact listing match",
          detail: "Offer to broaden filters or hand the request to an agent for off-market options.",
          severity: "warning"
        }
      ];

      if (knowledge.length) {
        noMatchInsights.push({
          kind: "knowledge",
          title: "Knowledge context available",
          detail: "Use the cited knowledge sources to answer the client while listing inventory is missing.",
          severity: "info"
        });
      }

      return this.buildResponse(
        request,
        knowledge.length
          ? `I could not find matching listings yet, but I found relevant knowledge: ${knowledge.map((chunk) => knowledgeLine(chunk)).join(" ")}`
          : "I could not find matching listings in this tenant workspace yet. Try broadening the market, budget, or beach-distance requirements.",
        [],
        [
          { source: "search", label: search.rankingExplanation },
          ...knowledge.map((chunk) => knowledgeCitation(chunk))
        ],
        noMatchInsights,
        ["relax-filters", "ask-agent-for-off-market-options"],
        buildAiChatContext(
          knowledge.length
            ? ["No matching listings were found.", ...knowledge.map((chunk) => knowledgeLine(chunk))]
            : ["No matching listings or knowledge chunks were found."],
          [
            { source: "search", label: search.rankingExplanation },
            ...knowledge.map((chunk) => knowledgeCitation(chunk))
          ]
        ),
        options
      );
    }

    const answer = [
      `I found ${items.length} matching listing${items.length === 1 ? "" : "s"}.`,
      `Top matches: ${matches.map((property) => shortPropertyLine(property)).join(" ")}`,
      search.items.length
        ? search.rankingExplanation
        : "The indexed search returned no hits, so I used the structured PostgreSQL filters as a fallback.",
      knowledge.length
        ? `Relevant knowledge: ${knowledge.map((chunk) => knowledgeLine(chunk)).join(" ")}`
        : ""
    ].join(" ");

    return this.buildResponse(
      request,
      answer,
      matches.map((property) => property.id),
      [
        { source: "search", label: search.interpretedIntent },
        ...matches.map((property) => propertyCitation(property)),
        ...knowledge.map((chunk) => knowledgeCitation(chunk))
      ],
      dueDiligence.insights,
      ["compare-results", "open-map", "save-search"],
      buildAiChatContext(
        [answer, ...buildListingEvidence(matches), ...dueDiligence.contextLines],
        [
          { source: "search", label: search.interpretedIntent },
          ...matches.map((property) => propertyCitation(property)),
          ...knowledge.map((chunk) => knowledgeCitation(chunk))
        ]
      ),
      options
    );
  }

  private answerClarifyPropertyReference(request: AiChatRequest): AiChatResponse {
    return {
      id: crypto.randomUUID(),
      message: request.message,
      answer:
        "Which listing would you like to view? Please send the listing name or choose one of the property cards above, and I can help arrange the next step.",
      matchedPropertyIds: [],
      citations: [],
      insights: [
        {
          kind: "handoff",
          title: "Listing reference needed",
          detail: "The visitor asked to view a property, but no previous recommendation was available in the conversation context.",
          severity: "info"
        }
      ],
      suggestedActions: ["ask-visitor-to-pick-listing", "create-lead"],
      generation: {
        mode: "deterministic-fallback",
        reason: "Clarification is required before property-specific retrieval."
      },
      createdAt: new Date().toISOString()
    };
  }

  private async retrieveKnowledge(tenantId: string, request: AiChatRequest) {
    const result = await this.knowledge.searchChunks(tenantId, {
      query: request.message,
      locale: request.locale,
      limit: 3
    });

    return result.items;
  }

  private async buildResponse(
    request: AiChatRequest,
    answer: string,
    matchedPropertyIds: string[],
    citations: AiChatCitation[],
    insights: AiChatInsight[],
    suggestedActions: string[],
    context: string,
    options: AiChatAskOptions = {}
  ): Promise<AiChatResponse> {
    if (this.textGenerator.isConfigured()) {
      return this.buildGeneratedResponse(
        request,
        answer,
        matchedPropertyIds,
        citations,
        insights,
        suggestedActions,
        context,
        options
      );
    }

    if (!this.allowDeterministicFallback()) {
      throw new ServiceUnavailableException(
        "AI provider is not configured. Set OPENAI_API_KEY and AI_CHAT_MODEL, or explicitly enable AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK for local demos."
      );
    }

    return {
      id: crypto.randomUUID(),
      message: request.message,
      answer,
      matchedPropertyIds,
      citations,
      insights,
      suggestedActions,
      generation: {
        mode: "deterministic-fallback",
        reason: "AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK is enabled"
      },
      createdAt: new Date().toISOString()
    };
  }

  private async buildGeneratedResponse(
    request: AiChatRequest,
    deterministicDraft: string,
    matchedPropertyIds: string[],
    citations: AiChatCitation[],
    insights: AiChatInsight[],
    suggestedActions: string[],
    context: string,
    options: AiChatAskOptions
  ): Promise<AiChatResponse> {
    const conversationContext = buildConversationContext(request);
    const generated = await this.textGenerator.generate({
      locale: request.locale,
      message: request.message,
      context: [conversationContext, context, "", "Deterministic retrieval draft:", deterministicDraft].filter(Boolean).join("\n"),
      citations,
      persona: options.persona
    });

    return {
      id: crypto.randomUUID(),
      message: request.message,
      answer: generated.answer,
      matchedPropertyIds,
      citations,
      insights,
      suggestedActions,
      generation: {
        mode: "llm",
        provider: generated.provider,
        model: generated.model
      },
      createdAt: new Date().toISOString()
    };
  }

  private allowDeterministicFallback(): boolean {
    return process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK === "true";
  }
}
