import { Inject, Injectable, Logger } from "@nestjs/common";
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
import { buildAiChatContext, buildListingEvidence, propertyCitation } from "./ai-chat-context.js";
import { buildAiChatPropertyResponseDraft } from "./ai-chat-property-response.js";
import { getRecentRecommendations, planAiChatRetrieval } from "./ai-chat-retrieval-plan.js";
import {
  buildAiChatResponse,
  buildClarifyPropertyReferenceResponse,
  buildUnavailablePropertyResponse
} from "./ai-chat-response.js";
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

    if (plan.mode === "listing-comparison") {
      return this.answerWithRecentListingComparison(tenantId, request, options);
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
      return buildUnavailablePropertyResponse(request);
    }

    const knowledge = intent.includeAdvice ? await this.retrieveKnowledge(tenantId, request) : [];
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
      property,
      requestMessage: request.message
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
    const knowledge = isMoreListingsRequest(request.message) ? [] : await this.retrieveKnowledge(tenantId, request);
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

  private async answerWithRecentListingComparison(
    tenantId: string,
    request: AiChatRequest,
    options: AiChatAskOptions
  ): Promise<AiChatResponse> {
    const recommendations = getRecentRecommendations(request).slice(0, 3);
    const properties = (
      await Promise.all(recommendations.map((listing) => this.properties.findById(tenantId, listing.propertyId)))
    ).filter((property): property is PropertySnapshot => Boolean(property));

    if (properties.length < 2) {
      return buildClarifyPropertyReferenceResponse(request);
    }

    const answer = buildRecentListingComparisonAnswer(properties, request.message, planComparison(request));
    const citations = properties.map((property) => propertyCitation(property));

    return this.buildResponse({
      citations,
      context: buildAiChatContext([answer, ...buildListingEvidence(properties)], citations),
      deterministicDraft: answer,
      insights: [],
      matchedPropertyIds: properties.map((property) => property.id),
      request,
      suggestedActions: ["compare-results", "open-map", "create-lead"],
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
    const searchRequest = {
      ...request,
      message: resolveEffectiveSearchMessage(request)
    };

    try {
      return await this.naturalLanguageSearch.search(tenantId, {
        locale: searchRequest.locale,
        query: searchRequest.message,
        market: searchRequest.market,
        purpose: searchRequest.purpose
      });
    } catch (error) {
      const fallback = this.interpretStructuredSearchFallback(searchRequest);

      this.logger.warn(
        `AI chat listing search failed for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`
      );

      return {
        filters: fallback.filters,
        interpretedIntent: fallback.interpretedIntent,
        items: [],
        rankingExplanation:
          "Indexed natural-language search was unavailable, so I used structured repository filters as a fallback.",
        total: 0
      };
    }
  }

  private interpretStructuredSearchFallback(request: AiChatRequest): {
    filters: PropertySearchRequest;
    interpretedIntent: string;
  } {
    try {
      const interpretation = this.naturalLanguageSearch.interpret({
        locale: request.locale,
        query: request.message,
        market: request.market,
        purpose: request.purpose
      });

      return {
        filters: interpretation.filters,
        interpretedIntent: interpretation.interpretedIntent
      };
    } catch (error) {
      this.logger.warn(
        `AI chat structured fallback interpretation failed: ${error instanceof Error ? error.message : String(error)}`
      );

      return {
        filters: buildStructuredFallbackFilters(request),
        interpretedIntent: `Structured fallback search for: "${request.message}"`
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

function planComparison(request: AiChatRequest): NonNullable<ReturnType<typeof planAiChatRetrieval>["comparison"]> {
  return planAiChatRetrieval(request).comparison ?? "beach-distance";
}

function buildRecentListingComparisonAnswer(
  properties: PropertySnapshot[],
  message: string,
  comparison: NonNullable<ReturnType<typeof planAiChatRetrieval>["comparison"]>
): string {
  if (comparison === "beach-distance") {
    const withKnownDistance = properties.filter((property) => property.beachDistanceMeters !== undefined);
    const closest = [...withKnownDistance].sort((left, right) => left.beachDistanceMeters! - right.beachDistanceMeters!)[0];
    const comparisonLines = properties.map((property) =>
      property.beachDistanceMeters === undefined
        ? `${property.title}: beach distance is not specified`
        : `${property.title}: ${property.beachDistanceMeters}m from the beach`
    );

    return closest
      ? `Among the options we just discussed, ${closest.title} is closest to the beach at ${closest.beachDistanceMeters}m. ${comparisonLines.join(
          " "
        )}`
      : `I can compare only the options we just discussed, but none of those listings has beach distance specified. ${comparisonLines.join(" ")}`;
  }

  const scored = properties
    .map((property) => ({ property, score: scorePropertyForComparison(property, comparison) }))
    .sort((left, right) => right.score - left.score);
  const best = scored[0]?.property;
  const criteria = comparisonLabel(comparison);
  const facts = scored.map(({ property }) => `${property.title}: ${comparisonFacts(property, comparison)}.`).join(" ");

  return best
    ? `Among the options we just discussed, ${best.title} looks strongest for ${criteria} based on the available listing facts. ${facts}`
    : `I can compare only the options we just discussed for ${criteria}. ${facts}`;
}

function scorePropertyForComparison(
  property: PropertySnapshot,
  comparison: NonNullable<ReturnType<typeof planAiChatRetrieval>["comparison"]>
): number {
  const amenities = new Set(property.amenities.map((amenity) => amenity.toLowerCase()));
  const hasAny = (...values: string[]) => values.some((value) => amenities.has(value));

  if (comparison === "investment") {
    return [
      property.monthlyRentEstimate ? 3 : 0,
      hasAny("sea-view", "beachfront", "pool") ? 2 : 0,
      property.maintenanceFeeMonthly ? 1 : 0,
      property.price.amount <= 3_000_000 ? 1 : 0
    ].reduce((sum, value) => sum + value, 0);
  }

  if (comparison === "pets") {
    return [hasAny("pet-friendly", "pets-allowed") ? 4 : 0, property.areaSqm >= 45 ? 1 : 0, property.bedrooms >= 2 ? 1 : 0].reduce(
      (sum, value) => sum + value,
      0
    );
  }

  if (comparison === "relocation") {
    return [
      hasAny("fiber-internet", "fast-internet", "coworking-lounge", "parking") ? 3 : 0,
      property.beachDistanceMeters !== undefined && property.beachDistanceMeters <= 800 ? 1 : 0,
      property.areaSqm >= 35 ? 1 : 0
    ].reduce((sum, value) => sum + value, 0);
  }

  return [
    property.bedrooms >= 2 ? 2 : 0,
    property.areaSqm >= 45 ? 2 : 0,
    hasAny("pool", "gym", "parking", "security", "playground") ? 1 : 0,
    property.beachDistanceMeters !== undefined && property.beachDistanceMeters <= 1000 ? 1 : 0
  ].reduce((sum, value) => sum + value, 0);
}

function comparisonLabel(comparison: NonNullable<ReturnType<typeof planAiChatRetrieval>["comparison"]>): string {
  const labels = {
    "beach-distance": "beach access",
    investment: "investment",
    living: "living",
    pets: "living with pets",
    relocation: "relocation"
  };

  return labels[comparison];
}

function comparisonFacts(
  property: PropertySnapshot,
  comparison: NonNullable<ReturnType<typeof planAiChatRetrieval>["comparison"]>
): string {
  const rent = property.monthlyRentEstimate
    ? `estimated rent ${property.monthlyRentEstimate.amount} ${property.monthlyRentEstimate.currency}/mo`
    : "rent estimate missing";
  const fee = property.maintenanceFeeMonthly
    ? `maintenance ${property.maintenanceFeeMonthly.amount} ${property.maintenanceFeeMonthly.currency}/mo`
    : "maintenance fee missing";
  const beach =
    property.beachDistanceMeters === undefined ? "beach distance not specified" : `${property.beachDistanceMeters}m from the beach`;
  const amenities = property.amenities.length ? `amenities ${property.amenities.slice(0, 4).join(", ")}` : "amenities not specified";

  if (comparison === "investment") {
    return `${property.price.amount} ${property.price.currency}, ${rent}, ${fee}, ${amenities}`;
  }

  if (comparison === "pets") {
    return `${property.areaSqm} sqm, ${property.bedrooms} bedroom${property.bedrooms === 1 ? "" : "s"}, ${amenities}`;
  }

  if (comparison === "relocation") {
    return `${property.areaSqm} sqm, ${beach}, ${amenities}`;
  }

  return `${property.areaSqm} sqm, ${property.bedrooms} bedroom${property.bedrooms === 1 ? "" : "s"}, ${beach}, ${amenities}`;
}

function resolveEffectiveSearchMessage(request: AiChatRequest): string {
  if (!isMoreListingsRequest(request.message)) {
    return request.message;
  }

  return [...(request.conversation ?? [])]
    .reverse()
    .find((turn) => turn.role === "user" && !isMoreListingsRequest(turn.text) && looksLikeSearchRequest(turn.text))
    ?.text ?? request.message;
}

function isMoreListingsRequest(message: string): boolean {
  return /\b(?:more|another|other|else|all|everything|next|show\s+all|see\s+all)\b|еще|ещё|друг|остальн|все вариант|покажи все|เพิ่มเติม|ทั้งหมด|其他|更多|全部|所有/i.test(
    message
  );
}

function looksLikeSearchRequest(message: string): boolean {
  return /find|show|recommend|suggest|condo|apartment|house|villa|rent|buy|найд|подбер|покаж|кондо|квартир|дом|аренд|купить|หา|แนะนำ|คอนโด|ซื้อ|เช่า|找|推荐|推薦|公寓|买|買|租/i.test(
    message
  );
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
