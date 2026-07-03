import { Inject, Injectable } from "@nestjs/common";
import type {
  NaturalLanguagePropertySearchResponse,
  NaturalLanguageSearchRequest,
  PropertySearchRequest
} from "@propertyflow/contracts";
import type { PropertyPurpose, ThailandMarket } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

interface InterpretationResult {
  interpretedIntent: string;
  filters: PropertySearchRequest;
  rankingExplanation: string;
  purpose?: PropertyPurpose;
}

@Injectable()
export class NaturalLanguagePropertySearchService {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  async search(tenantId: string, request: NaturalLanguageSearchRequest): Promise<NaturalLanguagePropertySearchResponse> {
    const interpretation = this.interpret(request);
    const items = await this.properties.search(tenantId, interpretation.filters);

    return {
      interpretedIntent: interpretation.interpretedIntent,
      filters: {
        ...interpretation.filters,
        lifestyleSignals: this.detectLifestyleSignals(request.query),
        investmentSignals: interpretation.purpose === "investment" ? ["rental-yield", "occupancy-demand"] : []
      },
      rankingExplanation: interpretation.rankingExplanation,
      items,
      total: items.length
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

    const maxPriceThb = this.detectMaxPriceThb(normalized);
    if (maxPriceThb) {
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
          ? `Rule-based interpreter extracted ${explanations.join("; ")}.`
          : "Rule-based interpreter did not find strict filters, so results are tenant-wide.",
      purpose
    };
  }

  private normalize(query: string): string {
    return query.toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ").trim();
  }

  private detectMarket(query: string): ThailandMarket | undefined {
    const markets: Array<[ThailandMarket, RegExp]> = [
      ["pattaya", /\b(pattaya|паттайя|паттайе|паттайи)\b/],
      ["phuket", /\b(phuket|пхукет|пхукете|пхукета)\b/],
      ["bangkok", /\b(bangkok|бангкок|бангкоке|бангкока)\b/],
      ["hua-hin", /\b(hua hin|hua-hin|хуахин|хуа хин)\b/],
      ["koh-samui", /\b(koh samui|samui|koh-samui|самуи|ко самуи)\b/]
    ];

    return markets.find(([, pattern]) => pattern.test(query))?.[0];
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
      ["pool", /\b(pool|swimming pool|бассейн|бассейном)\b/],
      ["gym", /\b(gym|fitness|фитнес|зал|спортзал)\b/],
      ["sea-view", /\b(sea view|ocean view|вид на море|с видом на море)\b/],
      ["fast-internet", /\b(fast internet|good internet|быстрый интернет|хороший интернет)\b/],
      ["coworking", /\b(coworking|коворкинг|коворкинги)\b/]
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

