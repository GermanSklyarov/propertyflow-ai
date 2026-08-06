import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type {
  AiAdvisorSummary,
  AiChatCitation,
  AiChatInsight,
  AiChatRequest,
  AiChatResponse,
  NaturalLanguagePropertySearchResponse,
  NeighborhoodIntelligence,
  PropertySearchRequest
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { KnowledgeDocumentService } from "../../knowledge/application/knowledge-document.service.js";
import { AiPropertyAdvisorService } from "../../properties/application/services/ai-property-advisor.service.js";
import { NaturalLanguagePropertySearchService } from "../../properties/application/services/natural-language-property-search.service.js";
import { NeighborhoodIntelligenceService } from "../../properties/application/services/neighborhood-intelligence.service.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../properties/domain/property.repository.js";
import {
  buildAiChatDueDiligencePayload,
  buildAiChatDueDiligencePayloadFromSummaries,
  type AiChatDueDiligencePayload
} from "./ai-chat-due-diligence.js";
import { classifyAiChatIntent } from "./ai-chat-intent.js";
import { buildAiChatPropertyResponseDraft } from "./ai-chat-property-response.js";
import { planAiChatRetrieval } from "./ai-chat-retrieval-plan.js";
import { buildAiChatResponse, buildClarifyPropertyReferenceResponse } from "./ai-chat-response.js";
import { buildAiChatSearchResponseDraft } from "./ai-chat-search-response.js";
import { AI_TEXT_GENERATOR, type AiConciergePersona, type AiTextGenerator } from "./ai-text-generator.js";

export interface AiChatAskOptions {
  persona?: AiConciergePersona;
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

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
      return buildClarifyPropertyReferenceResponse(request);
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

    const knowledge = await this.retrieveKnowledge(tenantId, request);
    const advisorSummary = intent.includeAdvice ? await this.retrieveAdvisorSummary(tenantId, property) : undefined;
    const dueDiligence = advisorSummary
      ? buildAiChatDueDiligencePayloadFromSummaries([{ property, summary: advisorSummary }])
      : intent.includeAdvice
        ? emptyDueDiligencePayload()
        : await this.retrieveDueDiligence(tenantId, [property]);
    const neighborhood = intent.includeNeighborhood ? await this.retrieveNeighborhood(tenantId, property) : undefined;
    const draft = buildAiChatPropertyResponseDraft({
      advisorSummary,
      dueDiligence,
      intent,
      knowledge,
      neighborhood,
      property
    });

    return this.buildResponse({
      ...draft,
      request,
      ...options
    });
  }

  private async answerWithSearch(
    tenantId: string,
    request: AiChatRequest,
    options: AiChatAskOptions
  ): Promise<AiChatResponse> {
    const search = await this.retrieveListingSearch(tenantId, request);
    const fallbackItems = search.items.length
      ? []
      : await this.properties.search(tenantId, search.filters);
    const items = search.items.length ? search.items : fallbackItems;
    const matches = items.slice(0, 3);
    const knowledge = await this.retrieveKnowledge(tenantId, request);
    const dueDiligence = await this.retrieveDueDiligence(tenantId, matches);
    const draft = buildAiChatSearchResponseDraft({
      dueDiligence,
      items,
      knowledge,
      matches,
      search
    });

    return this.buildResponse({
      ...draft,
      request,
      ...options
    });
  }

  private async retrieveKnowledge(tenantId: string, request: AiChatRequest) {
    try {
      const result = await this.knowledge.searchChunks(tenantId, {
        query: request.message,
        locale: request.locale,
        limit: 3
      });

      return result.items;
    } catch (error) {
      this.logger.warn(
        `AI chat knowledge retrieval failed for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`
      );

      return [];
    }
  }

  private async retrieveListingSearch(
    tenantId: string,
    request: AiChatRequest
  ): Promise<NaturalLanguagePropertySearchResponse> {
    try {
      return await this.naturalLanguageSearch.search(tenantId, {
        locale: request.locale,
        query: request.message,
        market: request.market,
        purpose: request.purpose
      });
    } catch (error) {
      const filters = buildStructuredFallbackFilters(request);

      this.logger.warn(
        `AI chat listing search failed for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`
      );

      return {
        filters,
        interpretedIntent: `Structured fallback search for: "${request.message}"`,
        items: [],
        rankingExplanation:
          "Indexed natural-language search was unavailable, so I used structured repository filters as a fallback.",
        total: 0
      };
    }
  }

  private async retrieveDueDiligence(
    tenantId: string,
    properties: PropertySnapshot[]
  ): Promise<AiChatDueDiligencePayload> {
    try {
      return await buildAiChatDueDiligencePayload(tenantId, properties, this.advisor);
    } catch (error) {
      this.logger.warn(
        `AI chat due diligence retrieval failed for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`
      );

      return emptyDueDiligencePayload();
    }
  }

  private async retrieveAdvisorSummary(
    tenantId: string,
    property: PropertySnapshot
  ): Promise<AiAdvisorSummary | undefined> {
    try {
      return await this.advisor.summarize(tenantId, property.id);
    } catch (error) {
      this.logger.warn(
        `AI chat advisor summary failed for tenant ${tenantId}, property ${property.id}: ${error instanceof Error ? error.message : String(error)}`
      );

      return undefined;
    }
  }

  private async retrieveNeighborhood(
    tenantId: string,
    property: PropertySnapshot
  ): Promise<NeighborhoodIntelligence | undefined> {
    try {
      return await this.neighborhoodIntelligence.analyze(tenantId, property.id);
    } catch (error) {
      this.logger.warn(
        `AI chat neighborhood enrichment failed for tenant ${tenantId}, property ${property.id}: ${error instanceof Error ? error.message : String(error)}`
      );

      return undefined;
    }
  }

  private buildResponse(
    options: AiChatAskOptions & {
      citations: AiChatCitation[];
      context: string;
      deterministicDraft: string;
      insights: AiChatInsight[];
      matchedPropertyIds: string[];
      request: AiChatRequest;
      suggestedActions: string[];
    }
  ): Promise<AiChatResponse> {
    return buildAiChatResponse({
      ...options,
      textGenerator: this.textGenerator,
      useDeterministicFallback: process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK === "true"
    });
  }
}

function emptyDueDiligencePayload(): AiChatDueDiligencePayload {
  return { contextLines: [], insights: [] };
}

function buildStructuredFallbackFilters(request: AiChatRequest): PropertySearchRequest {
  return {
    market: request.market,
    query: request.message
  };
}
