import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
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
    if (request.propertyId) {
      return this.answerAboutProperty(tenantId, request, options);
    }

    return this.answerWithSearch(tenantId, request, options);
  }

  private async answerAboutProperty(
    tenantId: string,
    request: AiChatRequest,
    options: AiChatAskOptions
  ): Promise<AiChatResponse> {
    const property = await this.properties.findById(tenantId, request.propertyId!);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const normalized = this.normalize(request.message);
    const citations: AiChatCitation[] = [this.propertyCitation(property)];
    const answerParts = [this.describeProperty(property)];
    const knowledge = await this.retrieveKnowledge(tenantId, request);
    const dueDiligenceContext = await this.buildDueDiligenceContext(tenantId, [property]);

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

    return this.buildResponse(
      request,
      answerParts.join(" "),
      [property.id],
      citations,
      ["compare-similar-properties", "open-investment-calculator", "create-lead"],
      this.buildContext([...answerParts, ...dueDiligenceContext], citations),
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
    const dueDiligenceContext = await this.buildDueDiligenceContext(tenantId, matches);

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
        ["relax-filters", "ask-agent-for-off-market-options"],
        this.buildContext(
          knowledge.length
            ? ["No matching listings were found.", ...knowledge.map((chunk) => this.knowledgeLine(chunk))]
            : ["No matching listings or knowledge chunks were found."],
          [
            { source: "search", label: search.rankingExplanation },
            ...knowledge.map((chunk) => this.knowledgeCitation(chunk))
          ]
        ),
        options
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
      ["compare-results", "open-map", "save-search"],
      this.buildContext(
        [answer, ...dueDiligenceContext],
        [
          { source: "search", label: search.interpretedIntent },
          ...matches.map((property) => this.propertyCitation(property)),
          ...knowledge.map((chunk) => this.knowledgeCitation(chunk))
        ]
      ),
      options
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

  private async buildResponse(
    request: AiChatRequest,
    answer: string,
    matchedPropertyIds: string[],
    citations: AiChatCitation[],
    suggestedActions: string[],
    context: string,
    options: AiChatAskOptions = {}
  ): Promise<AiChatResponse> {
    if (this.textGenerator.isConfigured()) {
      return this.buildGeneratedResponse(request, answer, matchedPropertyIds, citations, suggestedActions, context, options);
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
    suggestedActions: string[],
    context: string,
    options: AiChatAskOptions
  ): Promise<AiChatResponse> {
    const generated = await this.textGenerator.generate({
      locale: request.locale,
      message: request.message,
      context: [context, "", "Deterministic retrieval draft:", deterministicDraft].join("\n"),
      citations,
      persona: options.persona
    });

    return {
      id: crypto.randomUUID(),
      message: request.message,
      answer: generated.answer,
      matchedPropertyIds,
      citations,
      suggestedActions,
      generation: {
        mode: "llm",
        provider: generated.provider,
        model: generated.model
      },
      createdAt: new Date().toISOString()
    };
  }

  private buildContext(lines: string[] | string, citations: AiChatCitation[]): string {
    const contextLines = Array.isArray(lines) ? lines : [lines];

    return [
      ...contextLines,
      "",
      "Source labels available through the separate citations API field:",
      ...citations.map((citation) => `- ${citation.label}`)
    ].join("\n");
  }

  private async buildDueDiligenceContext(tenantId: string, properties: PropertySnapshot[]): Promise<string[]> {
    if (!properties.length) {
      return [];
    }

    const summaries = await Promise.all(
      properties.map(async (property) => ({
        property,
        summary: await this.advisor.summarize(tenantId, property.id)
      }))
    );

    return [
      "Structured due diligence context for risks and watch-outs. Treat these as tenant-data-backed signals or checks to verify, not as legal advice or confirmed defects:",
      ...summaries.map(({ property, summary }) => {
        const signals = [
          summary.cons.length ? `watch-outs: ${summary.cons.join(" ")}` : undefined,
          summary.risks.length ? `data gaps/risks: ${summary.risks.join(" ")}` : undefined,
          summary.questionsToAskAgent.length
            ? `verification questions: ${summary.questionsToAskAgent.join(" ")}`
            : undefined
        ].filter(Boolean);

        return `${property.title}: ${signals.length ? signals.join(" ") : "no material watch-outs were detected from structured fields."}`;
      })
    ];
  }

  private allowDeterministicFallback(): boolean {
    return process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK === "true";
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

    const rentalPrice = property.rentalPriceMonthly
      ? ` Rental ask is ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/mo.`
      : "";

    return `${property.title} is a ${property.bedrooms}-bedroom ${property.kind} in ${property.market}, ${beach}, listed for ${property.listingType}, priced at ${property.price.amount} ${property.price.currency}.${rentalPrice}`;
  }

  private shortPropertyLine(property: PropertySnapshot): string {
    const rentalAsk = property.rentalPriceMonthly
      ? `rental ask ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/mo`
      : undefined;
    const rent = property.monthlyRentEstimate
      ? `estimated rent ${property.monthlyRentEstimate.amount} ${property.monthlyRentEstimate.currency}/mo`
      : "rent estimate missing";

    return `${property.title} (${property.market}, ${property.listingType}, ${property.price.amount} ${property.price.currency}, ${rentalAsk ?? rent}).`;
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
