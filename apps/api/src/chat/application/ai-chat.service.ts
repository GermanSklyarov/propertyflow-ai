import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AiChatCitation,
  AiChatRequest,
  AiChatResponse,
  KnowledgeDocumentChunkSnapshot
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { KnowledgeDocumentService } from "../../knowledge/application/knowledge-document.service.js";
import { AiPropertyAdvisorService } from "../../properties/application/services/ai-property-advisor.service.js";
import { NaturalLanguagePropertySearchService } from "../../properties/application/services/natural-language-property-search.service.js";
import { NeighborhoodIntelligenceService } from "../../properties/application/services/neighborhood-intelligence.service.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../properties/domain/property.repository.js";

@Injectable()
export class AiChatService {
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(AiPropertyAdvisorService) private readonly advisor: AiPropertyAdvisorService,
    @Inject(NaturalLanguagePropertySearchService)
    private readonly naturalLanguageSearch: NaturalLanguagePropertySearchService,
    @Inject(NeighborhoodIntelligenceService)
    private readonly neighborhoodIntelligence: NeighborhoodIntelligenceService,
    @Inject(KnowledgeDocumentService) private readonly knowledge: KnowledgeDocumentService
  ) {}

  async ask(tenantId: string, request: AiChatRequest): Promise<AiChatResponse> {
    if (request.propertyId) {
      return this.answerAboutProperty(tenantId, request);
    }

    return this.answerWithSearch(tenantId, request);
  }

  private async answerAboutProperty(tenantId: string, request: AiChatRequest): Promise<AiChatResponse> {
    const property = await this.properties.findById(tenantId, request.propertyId!);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const normalized = this.normalize(request.message);
    const citations: AiChatCitation[] = [this.propertyCitation(property)];
    const answerParts = [this.describeProperty(property)];
    const knowledge = await this.retrieveKnowledge(tenantId, request);

    if (this.isNeighborhoodQuestion(normalized)) {
      const neighborhood = await this.neighborhoodIntelligence.analyze(tenantId, property.id);
      citations.push({
        source: "neighborhood",
        propertyId: property.id,
        title: property.title,
        label: `Neighborhood intelligence, walkability ${neighborhood.walkabilityScore}/5`
      });
      answerParts.push(neighborhood.summary);
    }

    if (this.isAdviceQuestion(normalized)) {
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
      citations.push(...knowledge.map((chunk) => this.knowledgeCitation(chunk)));
      answerParts.push(`Relevant knowledge: ${knowledge.map((chunk) => this.knowledgeLine(chunk)).join(" ")}`);
    }

    return this.buildResponse(request, answerParts.join(" "), [property.id], citations, [
      "compare-similar-properties",
      "open-investment-calculator",
      "create-lead"
    ]);
  }

  private async answerWithSearch(tenantId: string, request: AiChatRequest): Promise<AiChatResponse> {
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

    if (!matches.length) {
      return this.buildResponse(
        request,
        knowledge.length
          ? `I could not find matching listings yet, but I found relevant knowledge: ${knowledge.map((chunk) => this.knowledgeLine(chunk)).join(" ")}`
          : "I could not find matching listings in this tenant workspace yet. Try broadening the market, budget, or beach-distance requirements.",
        [],
        [
          { source: "search", label: search.rankingExplanation },
          ...knowledge.map((chunk) => this.knowledgeCitation(chunk))
        ],
        ["relax-filters", "ask-agent-for-off-market-options"]
      );
    }

    const answer = [
      `I found ${items.length} matching listing${items.length === 1 ? "" : "s"}.`,
      `Top matches: ${matches.map((property) => this.shortPropertyLine(property)).join(" ")}`,
      search.items.length
        ? search.rankingExplanation
        : "The indexed search returned no hits, so I used the structured PostgreSQL filters as a fallback.",
      knowledge.length
        ? `Relevant knowledge: ${knowledge.map((chunk) => this.knowledgeLine(chunk)).join(" ")}`
        : ""
    ].join(" ");

    return this.buildResponse(
      request,
      answer,
      matches.map((property) => property.id),
      [
        { source: "search", label: search.interpretedIntent },
        ...matches.map((property) => this.propertyCitation(property)),
        ...knowledge.map((chunk) => this.knowledgeCitation(chunk))
      ],
      ["compare-results", "open-map", "save-search"]
    );
  }

  private async retrieveKnowledge(tenantId: string, request: AiChatRequest) {
    const result = await this.knowledge.searchChunks(tenantId, {
      query: request.message,
      locale: request.locale,
      limit: 3
    });

    return result.items;
  }

  private buildResponse(
    request: AiChatRequest,
    answer: string,
    matchedPropertyIds: string[],
    citations: AiChatCitation[],
    suggestedActions: string[]
  ): AiChatResponse {
    return {
      id: crypto.randomUUID(),
      message: request.message,
      answer,
      matchedPropertyIds,
      citations,
      suggestedActions,
      createdAt: new Date().toISOString()
    };
  }

  private propertyCitation(property: PropertySnapshot): AiChatCitation {
    return {
      source: "property",
      propertyId: property.id,
      title: property.title,
      label: `${property.title}, ${property.market}, ${property.price.amount} ${property.price.currency}`
    };
  }

  private knowledgeCitation(chunk: KnowledgeDocumentChunkSnapshot): AiChatCitation {
    return {
      source: "knowledge",
      documentId: chunk.documentId,
      title: chunk.title,
      label: `${chunk.title} (${chunk.kind}, chunk ${chunk.chunkIndex + 1}, score ${chunk.score})`
    };
  }

  private knowledgeLine(chunk: KnowledgeDocumentChunkSnapshot): string {
    const excerpt = chunk.content.length > 180 ? `${chunk.content.slice(0, 177)}...` : chunk.content;
    return `${chunk.title}: ${excerpt}`;
  }

  private describeProperty(property: PropertySnapshot): string {
    const beach = property.beachDistanceMeters
      ? `${property.beachDistanceMeters}m from the beach`
      : "beach distance is not specified";

    return `${property.title} is a ${property.bedrooms}-bedroom ${property.kind} in ${property.market}, ${beach}, priced at ${property.price.amount} ${property.price.currency}.`;
  }

  private shortPropertyLine(property: PropertySnapshot): string {
    const rent = property.monthlyRentEstimate
      ? `estimated rent ${property.monthlyRentEstimate.amount} ${property.monthlyRentEstimate.currency}/mo`
      : "rent estimate missing";

    return `${property.title} (${property.market}, ${property.price.amount} ${property.price.currency}, ${rent}).`;
  }

  private normalize(message: string): string {
    return message.toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ").trim();
  }

  private isNeighborhoodQuestion(message: string): boolean {
    return /(рядом|around|near|neighborhood|район|пляж|beach|кафе|cafe|школ|school|hospital|больниц)/.test(message);
  }

  private isAdviceQuestion(message: string): boolean {
    return /(почему|why|better|лучше|плюс|минус|risk|риск|investment|инвест|yield|доходн)/.test(message);
  }
}
