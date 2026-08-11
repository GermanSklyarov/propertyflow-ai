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

interface BudgetSignal {
  amountThb: number;
  cadence?: "monthly";
}

const MARKET_PATTERNS: Array<[ThailandMarket, RegExp]> = [
  ["pattaya", /(?:pattaya|паттай|พัทยา|芭提雅)/],
  ["phuket", /(?:phuket|пхукет|ภูเก็ต|普吉)/],
  ["bangkok", /(?:bangkok|бангкок|กรุงเทพ|曼谷)/],
  ["hua-hin", /(?:hua[\s-]?hin|хуахин|хуа\s?хин|หัวหิน|华欣|華欣)/],
  ["koh-samui", /(?:koh[\s-]?samui|samui|самуи|ко\s?самуи|เกาะสมุย|สมุย|苏梅|蘇梅)/]
];

const AMENITY_PATTERNS: Array<[string, RegExp]> = [
  ["pool", /(?:\b(?:pool|swimming pool)\b|бассейн|бассейном|สระว่ายน้ำ|泳池|游泳池)/],
  ["gym", /(?:\b(?:gym|fitness)\b|фитнес|спортзал|тренажерный зал|ฟิตเนส|健身房|健身)/],
  ["sea-view", /(?:\b(?:sea view|ocean view)\b|вид на море|с видом на море|панорам[а-я ]+мор|วิวทะเล|เห็นทะเล|海景|看海)/],
  ["fast-internet", /(?:\b(?:fast internet|good internet)\b|быстрый интернет|хороший интернет|อินเทอร์เน็ต|เน็ตแรง|网络|網絡|高速网|高速網)/],
  ["coworking", /(?:\bcoworking\b|коворкинг|коворкинги|โคเวิร์ก|โคเวิร์ค|共享办公|共享辦公)/]
];

const LIFESTYLE_PATTERNS: Array<[string, RegExp]> = [
  ["quiet-area", /(?:тих|спокойн|quiet|calm|เงียบ|สงบ|安静|安靜)/],
  ["cafes", /(?:кафе|coffee|restaurants|рестораны|ร้านกาแฟ|ร้านอาหาร|咖啡|餐厅|餐廳)/],
  ["beach-life", /(?:пляж|beach|мор|sea|ทะเล|ชายหาด|海边|海邊|海滩|海灘)/],
  ["remote-work", /(?:internet|интернет|coworking|коворкинг|remote|удален|ออนไลน์|เน็ต|远程|遠程|网络|網絡|共享办公|共享辦公)/],
  ["shopping", /(?:terminal 21|shopping|mall|торгов|ห้าง|商场|商場|购物|購物)/]
];

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

    const budget = this.detectBudgetThb(normalized);
    if (budget && (listingType === "rent" || budget.cadence === "monthly")) {
      filters.maxMonthlyRentThb = budget.amountThb;
      explanations.push(`maxMonthlyRentThb=${budget.amountThb}`);
    } else if (budget) {
      filters.maxPriceThb = budget.amountThb;
      explanations.push(`maxPriceThb=${budget.amountThb}`);
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
    return query
      .toLowerCase()
      .replaceAll("ё", "е")
      .replace(/[，。；：]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private detectMarket(query: string): ThailandMarket | undefined {
    return MARKET_PATTERNS.find(([, pattern]) => pattern.test(query))?.[0];
  }

  private detectBudgetThb(query: string): BudgetSignal | undefined {
    const cadence = /(?:month|monthly|per month|месяц|мес|ต่อเดือน|รายเดือน|每月|月租)/.test(query)
      ? "monthly"
      : undefined;
    const millionMatch = query.match(
      /(?:до|under|below|max|maximum|budget|งบ|ไม่เกิน|ต่ำกว่า|预算|預算|不超过|不超過|低于|低於)?\s*(\d+(?:[.,]\d+)?)\s*(?:млн|million|m|ล้าน|百万|百萬)\s*(?:бат|baht|thb|บาท|泰铢|泰銖)?/
    );
    if (millionMatch?.[1]) {
      return {
        amountThb: Math.round(Number(millionMatch[1].replace(",", ".")) * 1_000_000),
        cadence
      };
    }

    const tenThousandMatch = query.match(
      /(?:до|under|below|max|maximum|budget|งบ|ไม่เกิน|ต่ำกว่า|预算|預算|不超过|不超過|低于|低於)?\s*(\d+(?:[.,]\d+)?)\s*(?:万|萬)\s*(?:บาท|泰铢|泰銖|thb)?/
    );
    if (tenThousandMatch?.[1]) {
      return {
        amountThb: Math.round(Number(tenThousandMatch[1].replace(",", ".")) * 10_000),
        cadence
      };
    }

    const thbMatch = query.match(
      /(?:до|under|below|max|maximum|budget|งบ|ไม่เกิน|ต่ำกว่า|预算|預算|ไม่เกิน|不超过|不超過|低于|低於)?\s*(\d[\d\s,.]*)\s*(?:бат|baht|thb|บาท|泰铢|泰銖)/
    );
    if (thbMatch?.[1]) {
      const amount = Number(thbMatch[1].replace(/[^\d]/g, ""));
      return Number.isFinite(amount) && amount > 0 ? { amountThb: amount, cadence } : undefined;
    }

    const thousandMatch = query.match(
      /(?:до|under|below|max|maximum|budget|งบ|ไม่เกิน|ต่ำกว่า|预算|預算|不超过|不超過|低于|低於)?\s*(\d+(?:[.,]\d+)?)\s*(?:k|thousand|тыс)\s*(?:бат|baht|thb|บาท|泰铢|泰銖)?/
    );
    if (thousandMatch?.[1]) {
      return {
        amountThb: Math.round(Number(thousandMatch[1].replace(",", ".")) * 1_000),
        cadence
      };
    }

    return undefined;
  }

  private detectListingType(query: string): PropertySearchRequest["listingType"] | undefined {
    const investmentSaleIntent = /(?:rent out|yield|roi|invest|investment|сдач|доход|инвест|ลงทุน|ผลตอบแทน|投资|投資|收益|回报|回報)/.test(query);
    const rentalIntent = /(?:снять|сним|арендовать|аренда|rent|lease|monthly|per month|month|месяц|мес|เช่า|ให้เช่า|รายเดือน|ต่อเดือน|租房|租公寓|月租|每月)/.test(query);
    const saleIntent = /(?:купить|покуп|продаж|buy|purchase|sale|ownership|ซื้อ|ขาย|买|買|购买|購買|出售)/.test(query) || investmentSaleIntent;

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
    const explicit = query.match(/(\d+)\s*(?:bedroom|bedrooms|br|спальн|спальни|спален|ห้องนอน|卧室|臥室|房间|房間|房)/);
    if (explicit?.[1]) {
      return Number(explicit[1]);
    }

    if (/(?:\b(?:studio)\b|студия|студию|สตูดิโอ|开间|開間|单间|單間)/.test(query)) {
      return 0;
    }

    return undefined;
  }

  private detectMinAreaSqm(query: string): number | undefined {
    const match = query.match(/(?:от|from|min|minimum|ตั้งแต่|อย่างน้อย|至少)?\s*(\d+)\s*(?:м2|м²|sqm|sq m|square meters|ตร\.?\s?ม\.?|ตารางเมตร|平米|平方米)/);
    return match?.[1] ? Number(match[1]) : undefined;
  }

  private detectBeachDistanceMeters(query: string): number | undefined {
    if (/(рядом|near|close|walk|пешком|ใกล้|เดิน|近|靠近|步行).*(пляж|beach|мор|sea|ทะเล|ชายหาด|海|海边|海邊|海滩|海灘)/.test(query)) {
      return 1000;
    }

    if (
      /(10\s*(мин|minutes|min|นาที|分钟|分鐘).*(мор|sea|beach|пляж|ทะเล|ชายหาด|海|海边|海邊|海滩|海灘))|((мор|sea|beach|пляж|ทะเล|ชายหาด|海|海边|海邊|海滩|海灘).{0,30}10\s*(мин|minutes|min|นาที|分钟|分鐘))/.test(query)
    ) {
      return 800;
    }

    return undefined;
  }

  private detectAmenities(query: string): string[] {
    return AMENITY_PATTERNS.filter(([, pattern]) => pattern.test(query)).map(([amenity]) => amenity);
  }

  private detectPurpose(query: string): PropertyPurpose | undefined {
    if (/(инвест|доходн|roi|yield|rent out|сдач|ลงทุน|ผลตอบแทน|ปล่อยเช่า|投资|投資|收益|回报|回報|出租收益)/.test(query)) {
      return "investment";
    }

    if (/(переезд|relocat|move to|переехать|ย้าย|搬到|移居)/.test(query)) {
      return "relocation";
    }

    if (/(family|семь|семей|школ|ครอบครัว|เด็ก|โรงเรียน|家庭|家人|孩子|学校|學校)/.test(query)) {
      return "family";
    }

    if (/(жить|live|living|winter|зим|อยู่เอง|อาศัย|过冬|過冬|自住|居住)/.test(query)) {
      return "living";
    }

    return undefined;
  }

  private detectLifestyleSignals(query: string): string[] {
    const normalized = this.normalize(query);

    return LIFESTYLE_PATTERNS.filter(([, pattern]) => pattern.test(normalized)).map(([signal]) => signal);
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
  return (
    property.status === "available" &&
    property.areaSqm >= 10 &&
    (property.price.amount >= 100_000 || (property.rentalPriceMonthly?.amount ?? 0) >= 1_000) &&
    !/(^|\s)(smoke|starter import)\b/i.test(property.title)
  );
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
