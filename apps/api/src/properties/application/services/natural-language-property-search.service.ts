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
  rankingPreferences: RankingPreferences;
  rankingExplanation: string;
  purpose?: PropertyPurpose;
}

interface BudgetSignal {
  amountThb: number;
  cadence?: "monthly";
}

interface RankingPreferences {
  preferBeachProximity: boolean;
  preferBudgetPrice: boolean;
  preferFamilyFit: boolean;
  preferLargerArea: boolean;
  preferLuxuryFit: boolean;
  preferValueForMoney: boolean;
  preferWashingMachine: boolean;
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
  ["coworking", /(?:\bcoworking\b|коворкинг|коворкинги|โคเวิร์ก|โคเวิร์ค|共享办公|共享辦公)/],
  [
    "pet-friendly",
    /(?:\b(?:pet|pets|pet-friendly|pet friendly|dog|dogs|cat|cats|animal|animals)\b|с\s+животн|животн|питомц|собак|кошк|สัตว์เลี้ยง|หมา|สุนัข|แมว|宠物|寵物|狗|猫|貓)/
  ]
];

const LIFESTYLE_PATTERNS: Array<[string, RegExp]> = [
  ["quiet-area", /(?:тих|спокойн|quiet|calm|เงียบ|สงบ|安静|安靜)/],
  ["cafes", /(?:кафе|coffee|restaurants|рестораны|ร้านกาแฟ|ร้านอาหาร|咖啡|餐厅|餐廳)/],
  ["beach-life", /(?:пляж|beach|мор|sea|ทะเล|ชายหาด|海边|海邊|海滩|海灘)/],
  ["remote-work", /(?:internet|интернет|coworking|коворкинг|remote|удален|ออนไลน์|เน็ต|远程|遠程|网络|網絡|共享办公|共享辦公)/],
  ["shopping", /(?:terminal 21|shopping|mall|торгов|ห้าง|商场|商場|购物|購物)/],
  ["school-access", /(?:school|kindergarten|children|kids|child|family|школ|дет|семь|садик|ครอบครัว|เด็ก|โรงเรียน|家庭|孩子|学校|學校)/],
  ["pet-friendly", /(?:\b(?:pet|pets|pet-friendly|pet friendly|dog|dogs|cat|cats)\b|животн|питомц|собак|кошк|สัตว์เลี้ยง|宠物|寵物|狗|猫|貓)/]
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
    )
      .filter((item): item is PropertySnapshot => item !== null)
      .filter(isRecommendableProperty)
      .filter((item) => matchesStrictFilters(item, interpretation.filters));
    const rankedIndexed = await this.applyRanking(tenantId, request.query, indexedItems, interpretation.rankingPreferences);
    const fallbackItems = rankedIndexed.items.length >= 3
      ? []
      : (await this.properties.search(tenantId, {
          ...interpretation.filters,
          limit: 20,
          offset: 0,
          query: request.query,
          sort: "ai-fit"
        }))
          .filter(isRecommendableProperty)
          .filter((item) => matchesStrictFilters(item, interpretation.filters))
          .filter((item) => !rankedIndexed.items.some((indexedItem) => indexedItem.id === item.id));
    const rankedFallback = rankedIndexed.items.length >= 3
      ? { items: [] as PropertySnapshot[], vectorApplied: false }
      : await this.applyRanking(tenantId, request.query, fallbackItems, interpretation.rankingPreferences);
    const items = rankedIndexed.items.length ? [...rankedIndexed.items, ...rankedFallback.items] : rankedFallback.items;
    const vectorApplied = rankedIndexed.vectorApplied || rankedFallback.vectorApplied;
    const rankingExplanation = [
      interpretation.rankingExplanation,
      rankedIndexed.items.length >= 3
        ? undefined
        : rankedIndexed.items.length
          ? "Postgres filtered search supplemented the indexed shortlist with additional recommendable available listings."
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
      total: rankedIndexed.items.length ? Math.max(indexedResult.total, items.length) : rankedFallback.items.length
    };
  }

  private async applyRanking(
    tenantId: string,
    query: string,
    items: PropertySnapshot[],
    preferences: RankingPreferences
  ): Promise<{ items: PropertySnapshot[]; vectorApplied: boolean }> {
    if (items.length < 2) {
      return { items, vectorApplied: false };
    }

    const ranks = await this.vectorSearch.rankCandidates(tenantId, query, items.map((item) => item.id));

    if (!ranks.length) {
      return { items: rankByQueryPreferences(items, preferences), vectorApplied: false };
    }

    const lexicalScoreById = new Map(items.map((item, index) => [item.id, (items.length - index) / items.length]));
    const vectorScoreById = new Map(ranks.map((rank) => [rank.propertyId, rank.similarityScore]));

    return {
      items: [...items].sort((left, right) => {
        const preferenceOrder = compareByQueryPreferences(left, right, preferences);
        if (preferenceOrder !== 0) {
          return preferenceOrder;
        }

        const leftScore = hybridScore(left, lexicalScoreById, vectorScoreById, preferences);
        const rightScore = hybridScore(right, lexicalScoreById, vectorScoreById, preferences);

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

    const budget = this.detectBudgetThb(normalized);
    const listingType = this.detectListingType(normalized, budget);
    if (listingType) {
      filters.listingType = listingType;
      explanations.push(`listingType=${listingType}`);
    }

    if (budget && (listingType === "rent" || budget.cadence === "monthly")) {
      filters.maxMonthlyRentThb = budget.amountThb;
      explanations.push(`maxMonthlyRentThb=${budget.amountThb}`);
    } else if (budget) {
      filters.maxPriceThb = budget.amountThb;
      explanations.push(`maxPriceThb=${budget.amountThb}`);
    }

    const purpose = request.purpose ?? this.detectPurpose(normalized);
    const minBedrooms = this.detectMinBedrooms(normalized) ?? (purpose === "family" ? 2 : undefined);
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

    const requiredAmenities = Array.from(new Set([...this.detectAmenities(normalized), ...this.detectRequiredAmenities(normalized)]));
    if (requiredAmenities.length) {
      filters.requiredAmenities = requiredAmenities;
      explanations.push(`requiredAmenities=${requiredAmenities.join(",")}`);
    }

    const rankingPreferences = this.detectRankingPreferences(normalized);

    return {
      interpretedIntent: this.describeIntent(request.query, purpose, filters),
      filters,
      rankingPreferences,
      rankingExplanation:
        explanations.length > 0
          ? `Rule-based interpreter extracted ${explanations.join("; ")}. OpenSearch ranks matching indexed listings by text relevance and recency.${describeRankingPreferences(rankingPreferences)}`
          : `Rule-based interpreter did not find strict filters; OpenSearch ranks tenant listings by text relevance and recency.${describeRankingPreferences(rankingPreferences)}`,
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

  private detectListingType(query: string, budget?: BudgetSignal): PropertySearchRequest["listingType"] | undefined {
    const investmentSaleIntent = /(?:rent out|yield|roi|invest|investment|сдач|доход|инвест|ลงทุน|ผลตอบแทน|投资|投資|收益|回报|回報)/.test(query);
    const rentalIntent = /(?:снять|сним|арендовать|аренда|\brent\b|\brental\b|\blease\b|\bmonthly\b|\bper month\b|\bmonth\b|месяц|мес|เช่า|ให้เช่า|รายเดือน|ต่อเดือน|租房|租公寓|月租|每月)/.test(query);
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

    if (budget && budget.cadence !== "monthly" && budget.amountThb >= 1_000_000) {
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

  private detectRequiredAmenities(query: string): string[] {
    const requiredAmenities: string[] = [];

    if (
      /\b(?:definitely|must have|required|mandatory|has to have)\b.{0,40}\b(?:washing machine|washer|laundry machine)\b|\b(?:washing machine|washer|laundry machine)\b.{0,40}\b(?:definitely|required|mandatory|must)\b/i.test(
        query
      )
    ) {
      requiredAmenities.push("washing machine");
    }

    return requiredAmenities;
  }

  private detectPurpose(query: string): PropertyPurpose | undefined {
    if (/(инвест|доходн|invest|investment|roi|yield|rent out|сдач|ลงทุน|ผลตอบแทน|ปล่อยเช่า|投资|投資|收益|回报|回報|出租收益)/.test(query)) {
      return "investment";
    }

    if (/(переезд|relocat|move to|переехать|ย้าย|搬到|移居)/.test(query)) {
      return "relocation";
    }

    if (/(family|children|child|kids|kid|семь|семей|школ|дет|ครอบครัว|เด็ก|โรงเรียน|家庭|家人|孩子|学校|學校)/.test(query)) {
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

  private detectRankingPreferences(query: string): RankingPreferences {
    return {
      preferBeachProximity: /(?:\b(?:close to (?:the )?beach|near (?:the )?beach|walk(?:ing)? distance|beachfront|by the beach)\b|рядом.*пляж|у пляжа|пешком.*пляж|ใกล้.*ชายหาด|ติดทะเล|海边|海邊|海滩附近|海灘附近)/i.test(query),
      preferBudgetPrice: /(?:\b(?:budget-friendly|budget option|cheap|cheaper|affordable|low price|lowest price|economy|inexpensive)\b|бюджетн|дешев|недорог|подешевле|ประหยัด|ถูก|ราคาไม่แพง|便宜|实惠|實惠)/i.test(query),
      preferFamilyFit: /(?:school|kindergarten|children|kids|child|family|школ|дет|семь|садик|ครอบครัว|เด็ก|โรงเรียน|家庭|孩子|学校|學校)/i.test(query),
      preferLargerArea: /(?:\b(?:spacious|roomy|large|larger|big|bigger|more space|not tiny|not small)\b|простор|побольше|больш|не маленьк|กว้าง|พื้นที่|宽敞|寬敞|大一点|大一點)/i.test(query),
      preferLuxuryFit: /(?:\b(?:luxury|premium|elite|high-end|upscale|exclusive|best quality)\b|элит|премиум|люкс|дорог|ระดับพรีเมียม|หรู|豪华|豪華|高端)/i.test(query),
      preferValueForMoney: /(?:\b(?:best value|value for money|good deal|best deal|balanced|optimal|worth it)\b|цена.*качество|лучшее предложение|выгод|оптимальн|คุ้มค่า|性价比|性價比)/i.test(query),
      preferWashingMachine: /(?:\b(?:washing machine|washer|laundry machine)\b|стиральн|стиралк|เครื่องซักผ้า|洗衣机|洗衣機)/i.test(query)
    };
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

function matchesStrictFilters(property: PropertySnapshot, filters: PropertySearchRequest): boolean {
  if (filters.requiredAmenities?.some((amenity) => !property.amenities.includes(amenity))) {
    return false;
  }

  if (filters.listingType === "rent" && !["rent", "sale_or_rent"].includes(property.listingType)) {
    return false;
  }

  if (filters.listingType === "sale" && !["sale", "sale_or_rent"].includes(property.listingType)) {
    return false;
  }

  if (filters.market && property.market !== filters.market) {
    return false;
  }

  if (filters.maxMonthlyRentThb !== undefined && (property.rentalPriceMonthly?.amount ?? Number.POSITIVE_INFINITY) > filters.maxMonthlyRentThb) {
    return false;
  }

  if (filters.maxPriceThb !== undefined && property.price.amount > filters.maxPriceThb) {
    return false;
  }

  if (filters.minBedrooms !== undefined && property.bedrooms < filters.minBedrooms) {
    return false;
  }

  if (filters.minAreaSqm !== undefined && property.areaSqm < filters.minAreaSqm) {
    return false;
  }

  if (
    filters.maxBeachDistanceMeters !== undefined &&
    (property.beachDistanceMeters ?? Number.POSITIVE_INFINITY) > filters.maxBeachDistanceMeters
  ) {
    return false;
  }

  return true;
}

function rankByQueryPreferences(items: PropertySnapshot[], preferences: RankingPreferences): PropertySnapshot[] {
  if (!hasRankingPreferences(preferences)) {
    return items;
  }

  return [...items].sort((left, right) => compareByQueryPreferences(left, right, preferences));
}

function compareByQueryPreferences(left: PropertySnapshot, right: PropertySnapshot, preferences: RankingPreferences): number {
  if (preferences.preferWashingMachine) {
    const washerDelta = Number(hasAmenity(right, "washing machine")) - Number(hasAmenity(left, "washing machine"));
    if (washerDelta !== 0) {
      return washerDelta;
    }
  }

  if (preferences.preferBudgetPrice) {
    const priceDelta = comparablePrice(left) - comparablePrice(right);
    if (priceDelta !== 0) {
      return priceDelta;
    }
  }

  if (preferences.preferLuxuryFit) {
    const luxuryDelta = luxuryFitScore(right) - luxuryFitScore(left);
    if (luxuryDelta !== 0) {
      return luxuryDelta;
    }
  }

  if (preferences.preferValueForMoney) {
    const valueDelta = valueForMoneyScore(right) - valueForMoneyScore(left);
    if (valueDelta !== 0) {
      return valueDelta;
    }
  }

  if (preferences.preferFamilyFit) {
    const familyDelta = familyFitScore(right) - familyFitScore(left);
    if (familyDelta !== 0) {
      return familyDelta;
    }
  }

  if (preferences.preferLargerArea && right.areaSqm !== left.areaSqm) {
    return right.areaSqm - left.areaSqm;
  }

  if (preferences.preferBeachProximity) {
    const leftDistance = left.beachDistanceMeters ?? Number.POSITIVE_INFINITY;
    const rightDistance = right.beachDistanceMeters ?? Number.POSITIVE_INFINITY;
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }
  }

  return 0;
}

function hybridScore(
  property: PropertySnapshot,
  lexicalScoreById: Map<string, number>,
  vectorScoreById: Map<string, number>,
  preferences: RankingPreferences
): number {
  const lexicalScore = lexicalScoreById.get(property.id) ?? 0;
  const vectorScore = vectorScoreById.get(property.id);
  const softPreferenceScore = preferenceScore(property, preferences);

  return vectorScore === undefined
    ? lexicalScore * 0.3 + softPreferenceScore * 0.7
    : vectorScore * 0.55 + lexicalScore * 0.25 + softPreferenceScore * 0.2;
}

function preferenceScore(property: PropertySnapshot, preferences: RankingPreferences): number {
  const budgetScore = preferences.preferBudgetPrice ? 1 / Math.max(comparablePrice(property), 1) * 1_000_000 : 0;
  const luxuryScore = preferences.preferLuxuryFit ? luxuryFitScore(property) / 10 : 0;
  const valueScore = preferences.preferValueForMoney ? valueForMoneyScore(property) / 10 : 0;
  const washerScore = preferences.preferWashingMachine && hasAmenity(property, "washing machine") ? 0.4 : 0;
  const familyScore = preferences.preferFamilyFit ? familyFitScore(property) / 10 : 0;
  const areaScore = preferences.preferLargerArea ? Math.min(property.areaSqm / 80, 1) : 0;
  const beachScore =
    preferences.preferBeachProximity && property.beachDistanceMeters !== undefined
      ? Math.max(0, 1 - property.beachDistanceMeters / 3000)
      : 0;

  return Math.min(budgetScore + luxuryScore + valueScore + washerScore + familyScore + areaScore + beachScore, 1);
}

function hasRankingPreferences(preferences: RankingPreferences): boolean {
  return Object.values(preferences).some(Boolean);
}

function describeRankingPreferences(preferences: RankingPreferences): string {
  const labels = [
    preferences.preferBudgetPrice ? "budget price" : undefined,
    preferences.preferLuxuryFit ? "premium fit" : undefined,
    preferences.preferValueForMoney ? "value for money" : undefined,
    preferences.preferWashingMachine ? "washing machine" : undefined,
    preferences.preferFamilyFit ? "family fit" : undefined,
    preferences.preferLargerArea ? "larger layouts" : undefined,
    preferences.preferBeachProximity ? "beach proximity" : undefined
  ].filter(Boolean);

  return labels.length ? ` Relative preferences softly rerank toward ${labels.join(", ")}.` : "";
}

function comparablePrice(property: PropertySnapshot): number {
  return property.rentalPriceMonthly?.amount ?? property.price.amount;
}

function valueForMoneyScore(property: PropertySnapshot): number {
  const pricePerSqm = comparablePrice(property) / Math.max(property.areaSqm, 1);
  const amenityBonus = Math.min(property.amenities.length, 8) * 0.15;

  return Math.min(1_000_000 / Math.max(pricePerSqm, 1) + amenityBonus, 10);
}

function luxuryFitScore(property: PropertySnapshot): number {
  const premiumAmenityScore = countAmenityMatches(property, [
    "sea-view",
    "beachfront",
    "private pool",
    "jacuzzi",
    "sauna",
    "concierge",
    "high floor",
    "covered parking",
    "gym",
    "coworking",
    "high-speed internet"
  ]);
  const priceSignal = Math.min(comparablePrice(property) / 5_000_000, 3);
  const areaSignal = Math.min(property.areaSqm / 80, 2);

  return premiumAmenityScore * 1.5 + priceSignal + areaSignal;
}

function familyFitScore(property: PropertySnapshot): number {
  const familyAmenityScore = countAmenityMatches(property, [
    "kids playground",
    "playground",
    "school",
    "kindergarten",
    "family pool",
    "garden"
  ]);

  return familyAmenityScore * 3 + Math.min(property.bedrooms, 3) * 1.5 + Math.min(property.areaSqm / 25, 4);
}

function countAmenityMatches(property: PropertySnapshot, requestedAmenities: string[]): number {
  return requestedAmenities.filter((amenity) => property.amenities.some((propertyAmenity) => propertyAmenity.toLowerCase() === amenity)).length;
}

function hasAmenity(property: PropertySnapshot, amenity: string): boolean {
  return property.amenities.some((propertyAmenity) => propertyAmenity.toLowerCase() === amenity);
}
