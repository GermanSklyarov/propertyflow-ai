import { Inject, Injectable } from "@nestjs/common";
import type {
  IndexedPropertySearchRequest,
  NaturalLanguagePropertySearchResponse,
  NaturalLanguageSearchRequest,
  PropertySearchRequest
} from "@propertyflow/contracts";
import type { PropertyPurpose, PropertySnapshot, ThailandMarket } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";
import { IndexedPropertySearchService } from "./indexed-property-search.service.js";
import { PropertyVectorSearchService } from "./property-vector-search.service.js";

interface InterpretationResult {
  interpretedIntent: string;
  filters: PropertySearchRequest;
  rankingExplanation: string;
  purpose?: PropertyPurpose;
}

@Injectable()
export class NaturalLanguagePropertySearchService {
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(IndexedPropertySearchService) private readonly indexedSearch: IndexedPropertySearchService,
    @Inject(PropertyVectorSearchService) private readonly vectorSearch: PropertyVectorSearchService
  ) {}

  async search(tenantId: string, request: NaturalLanguageSearchRequest): Promise<NaturalLanguagePropertySearchResponse> {
    const interpretation = this.interpret(request);
    const indexedRequest: IndexedPropertySearchRequest = {
      ...interpretation.filters,
      query: request.query,
      limit: 20,
      offset: 0
    };
    const indexedResult = await this.indexedSearch.search(tenantId, indexedRequest);
    const indexedItems = (
      await Promise.all(
        indexedResult.items.map((item) => this.properties.findById(tenantId, item.propertyId))
      )
    ).filter((item): item is PropertySnapshot => item !== null).filter(isRecommendableProperty);
    const rankedIndexed = await this.applyVectorRanking(tenantId, request.query, indexedItems);
    const fallbackItems = rankedIndexed.items.length
      ? []
      : (await this.properties.search(tenantId, {
          ...interpretation.filters,
          limit: 20,
          offset: 0,
          query: request.query,
          sort: "ai-fit"
        })).filter(isRecommendableProperty);
    const rankedFallback = rankedIndexed.items.length
      ? { items: [] as PropertySnapshot[], vectorApplied: false }
      : await this.applyVectorRanking(tenantId, request.query, fallbackItems);
    const items = rankedIndexed.items.length ? rankedIndexed.items : rankedFallback.items;
    const vectorApplied = rankedIndexed.vectorApplied || rankedFallback.vectorApplied;
    const rankingExplanation = [
      interpretation.rankingExplanation,
      rankedIndexed.items.length
        ? undefined
        : "Postgres filtered search was used as a fallback because the indexed search returned no recommendable available listings.",
      vectorApplied
        ? "pgvector semantic similarity reranked recommendable available listings for Concierge fit."
        : undefined
    ].filter(Boolean).join(" ");

    return {
      interpretedIntent: interpretation.interpretedIntent,
      filters: {
        ...interpretation.filters,
        lifestyleSignals: this.detectLifestyleSignals(request.query),
        investmentSignals: interpretation.purpose === "investment" ? ["rental-yield", "occupancy-demand"] : []
      },
      rankingExplanation,
      items,
      total: rankedIndexed.items.length ? Math.min(indexedResult.total, rankedIndexed.items.length) : rankedFallback.items.length
    };
  }

  private async applyVectorRanking(
    tenantId: string,
    query: string,
    items: PropertySnapshot[]
  ): Promise<{ items: PropertySnapshot[]; vectorApplied: boolean }> {
    if (items.length < 2) {
      return { items, vectorApplied: false };
    }

    const ranks = await this.vectorSearch.rankCandidates(tenantId, query, items.map((item) => item.id));

    if (!ranks.length) {
      return { items, vectorApplied: false };
    }

    const lexicalScoreById = new Map(items.map((item, index) => [item.id, (items.length - index) / items.length]));
    const vectorScoreById = new Map(ranks.map((rank) => [rank.propertyId, rank.similarityScore]));

    return {
      items: [...items].sort((left, right) => {
        const leftScore = hybridScore(left.id, lexicalScoreById, vectorScoreById);
        const rightScore = hybridScore(right.id, lexicalScoreById, vectorScoreById);

        return rightScore - leftScore;
      }),
      vectorApplied: true
    };
  }

  interpret(request: NaturalLanguageSearchRequest): InterpretationResult {
    const normalized = this.normalize(request.query);
    const filters: PropertySearchRequest = {};
    const explanations: string[] = [];

    const market = request.market ?? this.detectMarket(normalized);
    if (market) {
      filters.market = market;
      explanations.push(`market=${market}`);
    }

    const listingType = this.detectListingType(normalized);
    if (listingType) {
      filters.listingType = listingType;
      explanations.push(`listingType=${listingType}`);
    }

    const maxPriceThb = this.detectMaxPriceThb(normalized);
    if (maxPriceThb && listingType === "rent") {
      filters.maxMonthlyRentThb = maxPriceThb;
      explanations.push(`maxMonthlyRentThb=${maxPriceThb}`);
    } else if (maxPriceThb) {
      filters.maxPriceThb = maxPriceThb;
      explanations.push(`maxPriceThb=${maxPriceThb}`);
    }

    const minBedrooms = this.detectMinBedrooms(normalized);
    if (minBedrooms !== undefined) {
      filters.minBedrooms = minBedrooms;
      explanations.push(`minBedrooms=${minBedrooms}`);
    }

    const minAreaSqm = this.detectMinAreaSqm(normalized);
    if (minAreaSqm !== undefined) {
      filters.minAreaSqm = minAreaSqm;
      explanations.push(`minAreaSqm=${minAreaSqm}`);
    }

    const beachDistance = this.detectBeachDistanceMeters(normalized);
    if (beachDistance !== undefined) {
      filters.maxBeachDistanceMeters = beachDistance;
      explanations.push(`maxBeachDistanceMeters=${beachDistance}`);
    }

    const requiredAmenities = this.detectAmenities(normalized);
    if (requiredAmenities.length) {
      filters.requiredAmenities = requiredAmenities;
      explanations.push(`requiredAmenities=${requiredAmenities.join(",")}`);
    }

    const purpose = request.purpose ?? this.detectPurpose(normalized);

    return {
      interpretedIntent: this.describeIntent(request.query, purpose, filters),
      filters,
      rankingExplanation:
        explanations.length > 0
          ? `Rule-based interpreter extracted ${explanations.join("; ")}. OpenSearch ranks matching indexed listings by text relevance and recency.`
          : "Rule-based interpreter did not find strict filters; OpenSearch ranks tenant listings by text relevance and recency.",
      purpose
    };
  }

  private normalize(query: string): string {
    return query.toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ").trim();
  }

  private detectMarket(query: string): ThailandMarket | undefined {
    const markets: Array<[ThailandMarket, string[]]> = [
      ["pattaya", ["pattaya", "паттай"]],
      ["phuket", ["phuket", "пхукет"]],
      ["bangkok", ["bangkok", "бангкок"]],
      ["hua-hin", ["hua hin", "hua-hin", "хуахин", "хуа хин"]],
      ["koh-samui", ["koh samui", "samui", "koh-samui", "самуи", "ко самуи"]]
    ];

    return markets.find(([, aliases]) => aliases.some((alias) => query.includes(alias)))?.[0];
  }

  private detectMaxPriceThb(query: string): number | undefined {
    const millionMatch = query.match(/(?:до|under|below|max|maximum|budget)\s*(\d+(?:[.,]\d+)?)\s*(?:млн|million|m)\s*(?:бат|baht|thb)?/);
    if (millionMatch?.[1]) {
      return Math.round(Number(millionMatch[1].replace(",", ".")) * 1_000_000);
    }

    const thbMatch = query.match(/(?:до|under|below|max|maximum|budget)\s*(\d[\d\s,.]*)\s*(?:бат|baht|thb)/);
    if (thbMatch?.[1]) {
      const amount = Number(thbMatch[1].replace(/[^\d]/g, ""));
      return Number.isFinite(amount) && amount > 0 ? amount : undefined;
    }

    return undefined;
  }

  private detectListingType(query: string): PropertySearchRequest["listingType"] | undefined {
    const rentalIntent = /(снять|арендовать|аренда|rent|lease)/.test(query);
    const saleIntent = /(купить|покуп|продаж|buy|purchase|sale)/.test(query);

    if (rentalIntent && saleIntent) {
      return "sale_or_rent";
    }

    if (rentalIntent) {
      return "rent";
    }

    if (saleIntent) {
      return "sale";
    }

    return undefined;
  }

  private detectMinBedrooms(query: string): number | undefined {
    const explicit = query.match(/(\d+)\s*(?:bedroom|bedrooms|br|спальн|спальни|спален)/);
    if (explicit?.[1]) {
      return Number(explicit[1]);
    }

    if (/\b(studio|студия|студию)\b/.test(query)) {
      return 0;
    }

    return undefined;
  }

  private detectMinAreaSqm(query: string): number | undefined {
    const match = query.match(/(?:от|from|min|minimum)\s*(\d+)\s*(?:м2|м²|sqm|sq m|square meters)/);
    return match?.[1] ? Number(match[1]) : undefined;
  }

  private detectBeachDistanceMeters(query: string): number | undefined {
    if (/(рядом|near|close|walk|пешком).*(пляж|beach|мор|sea)/.test(query)) {
      return 1000;
    }

    if (/(10\s*(мин|minutes|min).*(мор|sea|beach|пляж))|((мор|sea|beach|пляж).{0,30}10\s*(мин|minutes|min))/.test(query)) {
      return 800;
    }

    return undefined;
  }

  private detectAmenities(query: string): string[] {
    const amenities: Array<[string, RegExp]> = [
      ["pool", /(?:\b(?:pool|swimming pool)\b|бассейн|бассейном)/],
      ["gym", /(?:\b(?:gym|fitness)\b|фитнес|спортзал|тренажерный зал)/],
      ["sea-view", /(?:\b(?:sea view|ocean view)\b|вид на море|с видом на море|панорам[а-я ]+мор)/],
      ["fast-internet", /(?:\b(?:fast internet|good internet)\b|быстрый интернет|хороший интернет)/],
      ["coworking", /(?:\bcoworking\b|коворкинг|коворкинги)/]
    ];

    return amenities.filter(([, pattern]) => pattern.test(query)).map(([amenity]) => amenity);
  }

  private detectPurpose(query: string): PropertyPurpose | undefined {
    if (/(инвест|доходн|roi|yield|rent|аренд|сдач)/.test(query)) {
      return "investment";
    }

    if (/(переезд|relocat|move to|переехать)/.test(query)) {
      return "relocation";
    }

    if (/(family|семь|школ)/.test(query)) {
      return "family";
    }

    if (/(жить|live|winter|зим)/.test(query)) {
      return "living";
    }

    return undefined;
  }

  private detectLifestyleSignals(query: string): string[] {
    const signals: Array<[string, RegExp]> = [
      ["quiet-area", /(тих|quiet|calm)/],
      ["cafes", /(кафе|coffee|restaurants|рестораны)/],
      ["beach-life", /(пляж|beach|мор|sea)/],
      ["remote-work", /(internet|интернет|coworking|коворкинг|remote|удален)/],
      ["shopping", /(terminal 21|shopping|mall|торгов)/]
    ];

    return signals.filter(([, pattern]) => pattern.test(query)).map(([signal]) => signal);
  }

  private describeIntent(query: string, purpose: PropertyPurpose | undefined, filters: PropertySearchRequest): string {
    const parts = [`Search for properties matching: "${query}"`];

    if (purpose) {
      parts.push(`purpose=${purpose}`);
    }

    if (filters.market) {
      parts.push(`market=${filters.market}`);
    }

    return parts.join("; ");
  }
}

function isRecommendableProperty(property: PropertySnapshot): boolean {
  return property.status === "available";
}

function hybridScore(
  propertyId: string,
  lexicalScoreById: Map<string, number>,
  vectorScoreById: Map<string, number>
): number {
  const lexicalScore = lexicalScoreById.get(propertyId) ?? 0;
  const vectorScore = vectorScoreById.get(propertyId);

  return vectorScore === undefined ? lexicalScore * 0.35 : vectorScore * 0.65 + lexicalScore * 0.35;
}
