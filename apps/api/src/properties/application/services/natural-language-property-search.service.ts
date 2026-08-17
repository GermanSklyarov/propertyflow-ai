import { Inject, Injectable } from "@nestjs/common";
import type {
  IndexedPropertySearchRequest,
  NaturalLanguagePropertySearchResponse,
  NaturalLanguageSearchRequest,
  PropertySearchRequest
} from "@propertyflow/contracts";
import type { GeoPoint, PropertyKind, PropertyPurpose, PropertySnapshot, ThailandMarket } from "@propertyflow/domain";
import { LocationIntelligenceService } from "../../../chat/application/location-intelligence.js";
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
  preferCarFreeFit: boolean;
  preferFamilyFit: boolean;
  preferLargerArea: boolean;
  preferLuxuryFit: boolean;
  preferNightlifeAccess: boolean;
  preferQuietArea: boolean;
  preferRemoteWorkFit: boolean;
  preferRetireeComfort: boolean;
  preferValueForMoney: boolean;
  preferWashingMachine: boolean;
  preferWinterStay: boolean;
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
  [
    "remote-work",
    /(?:internet|интернет|coworking|коворкинг|remote|удален|freelance|freelancer|digital nomad|ออนไลน์|เน็ต|远程|遠程|自由职业|自由職業|数字游民|數字遊民|网络|網絡|共享办公|共享辦公)/
  ],
  ["nightlife", /(?:nightlife|adults only|adult only|party|bars?|clubs?|entertainment|walking street|boyz town|ночн|бар|клуб|тусов|развлеч|ปาร์ตี้|บาร์|ผับ|酒吧|夜生活|娱乐|娛樂)/],
  ["retiree-comfort", /(?:retiree|retired|retirement|senior|elderly|пенсионер|пенси[ию]|пожил|เกษียณ|ผู้สูงอายุ|退休|养老|養老|老年)/],
  ["winter-stay", /(?:winter|wintering|snowbird|long stay|long-stay|зимовк|зимовать|зиму|зимн|ระยะยาว|过冬|過冬|避寒)/],
  ["shopping", /(?:terminal 21|shopping|mall|торгов|ห้าง|商场|商場|购物|購物)/],
  ["car-free", /(?:without a car|no car|don'?t drive|do not drive|walkability|walkable|public transport|baht bus|songthaew|без машины|не вожу|нет машины|пешком|общественный транспорт|маршрутка|сонгтео|บาทบัส|รถสองแถว|ขนส่งสาธารณะ|ไม่ขับรถ|不用车|不用車|不开车|不開車|公共交通|双条车|雙條車)/],
  ["baht-bus", /(?:baht bus|songthaew|батбас|бат бас|сонгтео|маршрутка|บาทบัส|รถสองแถว|双条车|雙條車)/],
  ["supermarket-access", /(?:supermarket|grocery|convenience store|7-eleven|seven eleven|big c|lotus|makro|супермаркет|магазин|7-?eleven|продукт|ซูเปอร์มาร์เก็ต|ร้านสะดวกซื้อ|โลตัส|超市|便利店)/],
  ["school-access", /(?:school|kindergarten|children|kids|child|family|школ|реб[её]н|детьми|детск|дети|детей|семья|семьи|семье|семью|семей|садик|ครอบครัว|เด็ก|โรงเรียน|家庭|孩子|学校|學校)/],
  ["pet-friendly", /(?:\b(?:pet|pets|pet-friendly|pet friendly|dog|dogs|cat|cats)\b|животн|питомц|собак|кошк|สัตว์เลี้ยง|宠物|寵物|狗|猫|貓)/]
];

@Injectable()
export class NaturalLanguagePropertySearchService {
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(IndexedPropertySearchService) private readonly indexedSearch: IndexedPropertySearchService,
    @Inject(PropertyVectorSearchService) private readonly vectorSearch: PropertyVectorSearchService,
    @Inject(LocationIntelligenceService)
    private readonly locationIntelligence: LocationIntelligenceService = new LocationIntelligenceService()
  ) {}

  async search(tenantId: string, request: NaturalLanguageSearchRequest): Promise<NaturalLanguagePropertySearchResponse> {
    const interpretation = await this.enrichWithLocationFilters(request, this.interpret(request));
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
    const kinds = this.detectPropertyKinds(normalized);
    if (kinds.length === 1) {
      filters.kind = kinds[0];
      explanations.push(`kind=${kinds[0]}`);
    } else if (kinds.length > 1) {
      filters.kinds = kinds;
      explanations.push(`kinds=${kinds.join(",")}`);
    }

    const bedroomRange = this.detectBedroomRange(normalized);
    const minBedrooms = bedroomRange.minBedrooms ?? (purpose === "family" ? 2 : undefined);
    if (minBedrooms !== undefined) {
      filters.minBedrooms = minBedrooms;
      explanations.push(`minBedrooms=${minBedrooms}`);
    }
    if (bedroomRange.maxBedrooms !== undefined) {
      filters.maxBedrooms = bedroomRange.maxBedrooms;
      explanations.push(`maxBedrooms=${bedroomRange.maxBedrooms}`);
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

    const locationFeatureFilters = this.detectLocationFeatureFilters(normalized);
    Object.assign(filters, locationFeatureFilters.filters);
    explanations.push(...locationFeatureFilters.explanations);

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

  private async enrichWithLocationFilters(
    request: NaturalLanguageSearchRequest,
    interpretation: InterpretationResult
  ): Promise<InterpretationResult> {
    if (interpretation.filters.near || interpretation.filters.radiusMeters !== undefined) {
      return interpretation;
    }

    const target = await this.locationIntelligence.resolveComparisonTarget(request.query, interpretation.filters.market ?? request.market);

    if (!target || (target.kind !== "poi" && target.category !== "nightlife")) {
      return interpretation;
    }

    if (target.kind === "poi" && isAreaOnlyLocationMention(this.normalize(request.query), target.poi.label)) {
      return interpretation;
    }

    const radiusMeters = detectRequestedRadiusMeters(this.normalize(request.query)) ?? defaultRadiusMetersForQuery(this.normalize(request.query));
    const anchor = target.kind === "poi" ? target.poi : target.pois[0];

    if (!anchor) {
      return interpretation;
    }

    return {
      ...interpretation,
      filters: {
        ...interpretation.filters,
        near: anchor.location,
        radiusMeters
      },
      rankingExplanation: `${interpretation.rankingExplanation} Map geocoding resolved "${anchor.label}" once and applied radiusMeters=${radiusMeters} with geo filtering.`
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
    const rentalIntent = /(?:снять|сним|аренд|аренду|\brent\b|\brental\b|\blease\b|\bmonthly\b|\bper month\b|\bmonth\b|месяц|мес|เช่า|ให้เช่า|รายเดือน|ต่อเดือน|租房|租公寓|月租|每月)/.test(query);
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

  private detectBedroomRange(query: string): { minBedrooms?: number; maxBedrooms?: number } {
    const studioPattern = String.raw`(?:\b(?:studio)\b|студия|студию|สตูดิโอ|开间|開間|单间|單間)`;
    const oneBedroomPattern = String.raw`(?:\b(?:1|one)\s*(?:bedroom|bedrooms|br|bed|beds)\b|однушк|однокомнат|1\s*спальн)`;
    const studioOrOneBedroom = new RegExp(
      `(?:${studioPattern}.{0,40}(?:or|/|или).{0,40}${oneBedroomPattern}|${oneBedroomPattern}.{0,40}(?:or|/|или).{0,40}${studioPattern})`,
      "i"
    );
    if (studioOrOneBedroom.test(query)) {
      return { minBedrooms: 0, maxBedrooms: 1 };
    }

    const explicit = query.match(/(\d+)\s*\+?\s*(?:bedroom|bedrooms|br|спальн|спальни|спален|ห้องนอน|卧室|臥室|房间|房間|房)/);
    if (explicit?.[1]) {
      const bedrooms = Number(explicit[1]);
      const exactRequest = hasExactBedroomQualifier(query, explicit[0]);
      const isLowerBound = explicit[0].includes("+") || hasBedroomLowerBoundQualifier(query, explicit[0]);
      return exactRequest || !isLowerBound
        ? { minBedrooms: bedrooms, maxBedrooms: bedrooms }
        : { minBedrooms: bedrooms };
    }

    if (new RegExp(studioPattern, "i").test(query)) {
      const exactRequest = hasExactBedroomQualifier(query, "studio");
      return exactRequest ? { minBedrooms: 0, maxBedrooms: 0 } : { minBedrooms: 0 };
    }

    return {};
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

  private detectLocationFeatureFilters(query: string): { explanations: string[]; filters: PropertySearchRequest } {
    const filters: PropertySearchRequest = {};
    const explanations: string[] = [];
    const carFreeIntent = /(?:without a car|no car|don'?t drive|do not drive|walkability|walkable|public transport|без машины|не вожу|нет машины|пешком|общественный транспорт|ไม่ขับรถ|不用车|不用車|不开车|不開車|公共交通)/i.test(query);
    const bahtBusIntent = /(?:baht bus|songthaew|батбас|бат бас|сонгтео|маршрутка|บาทบัส|รถสองแถว|双条车|雙條車)/i.test(query);
    const supermarketIntent = /(?:supermarket|grocery|convenience store|7-eleven|seven eleven|big c|lotus|makro|супермаркет|магазин|продукт|ซูเปอร์มาร์เก็ต|ร้านสะดวกซื้อ|โลตัส|超市|便利店)/i.test(query);
    const mallIntent = /(?:terminal 21|shopping mall|mall|торгов|тц|ห้าง|ศูนย์การค้า|商场|商場)/i.test(query);
    const hospitalIntent = /(?:hospital|clinic|больниц|госпитал|клиник|โรงพยาบาล|医院|醫院)/i.test(query);
    const schoolIntent = /(?:international school|международн.{0,20}школ|international kindergarten|โรงเรียนนานาชาติ|国际学校|國際學校)/i.test(query);
    const airportIntent = /(?:airport|аэропорт|สนามบิน|机场|機場)/i.test(query);

    if (carFreeIntent) {
      filters.minWalkabilityScore = 70;
      filters.maxSupermarketDistanceMeters = Math.min(filters.maxSupermarketDistanceMeters ?? 900, 900);
      filters.maxPublicTransportDistanceMeters = Math.min(filters.maxPublicTransportDistanceMeters ?? 700, 700);
      explanations.push("minWalkabilityScore=70", "maxSupermarketDistanceMeters=900", "maxPublicTransportDistanceMeters=700");
    }

    if (bahtBusIntent) {
      filters.maxBahtBusRouteDistanceMeters = detectRequestedRadiusMeters(query) ?? 500;
      explanations.push(`maxBahtBusRouteDistanceMeters=${filters.maxBahtBusRouteDistanceMeters}`);
    }

    if (supermarketIntent) {
      filters.maxSupermarketDistanceMeters = Math.min(filters.maxSupermarketDistanceMeters ?? 1000, detectRequestedRadiusMeters(query) ?? 1000);
      explanations.push(`maxSupermarketDistanceMeters=${filters.maxSupermarketDistanceMeters}`);
    }

    if (mallIntent) {
      filters.maxMallDistanceMeters = detectRequestedRadiusMeters(query) ?? 3000;
      explanations.push(`maxMallDistanceMeters=${filters.maxMallDistanceMeters}`);
    }

    if (hospitalIntent) {
      filters.maxHospitalDistanceMeters = detectRequestedRadiusMeters(query) ?? 5000;
      explanations.push(`maxHospitalDistanceMeters=${filters.maxHospitalDistanceMeters}`);
    }

    if (schoolIntent) {
      filters.maxInternationalSchoolDistanceMeters = detectRequestedRadiusMeters(query) ?? 5000;
      explanations.push(`maxInternationalSchoolDistanceMeters=${filters.maxInternationalSchoolDistanceMeters}`);
    }

    if (airportIntent) {
      filters.maxAirportConnectionDistanceMeters = detectRequestedRadiusMeters(query) ?? 45_000;
      explanations.push(`maxAirportConnectionDistanceMeters=${filters.maxAirportConnectionDistanceMeters}`);
    }

    return { explanations, filters };
  }

  private detectPurpose(query: string): PropertyPurpose | undefined {
    if (/(инвест|доходн|invest|investment|roi|yield|rent out|сдач|ลงทุน|ผลตอบแทน|ปล่อยเช่า|投资|投資|收益|回报|回報|出租收益)/.test(query)) {
      return "investment";
    }

    if (/(переезд|relocat|move to|переехать|ย้าย|搬到|移居)/.test(query)) {
      return "relocation";
    }

    if (/(family|children|child|kids|kid|семья|семьи|семье|семью|семей|школ|реб[её]н|детьми|детск|дети|детей|ครอบครัว|เด็ก|โรงเรียน|家庭|家人|孩子|学校|學校)/.test(query)) {
      return "family";
    }

    if (
      /(жить|live|living|winter|зим|retiree|retired|retirement|senior|freelance|freelancer|digital nomad|snowbird|long stay|long-stay|อยู่เอง|อาศัย|เกษียณ|过冬|過冬|自住|居住|退休|养老|養老|数字游民|數字遊民)/.test(
        query
      )
    ) {
      return "living";
    }

    return undefined;
  }

  private detectPropertyKinds(query: string): PropertyKind[] {
    if (/\b(?:villa|villas)\b|вилл|วิลล่า|别墅|別墅/i.test(query)) {
      return ["villa"];
    }

    if (/\b(?:townhouse|townhome|town house|town home)\b|таунхаус|ทาวน์เฮาส์|联排|聯排/i.test(query)) {
      return ["townhouse"];
    }

    if (/\b(?:house|houses|home|homes)\b|(?:^|[^а-яё])дома?(?:$|[^а-яё])|บ้าน|房子|住宅/i.test(query)) {
      return ["villa", "townhouse"];
    }

    if (/\b(?:condo|condominium|apartment|apartments|flat|unit)\b|кондо|квартир|апартамент|ห้องชุด|คอนโด|公寓|单元|單元/i.test(query)) {
      return ["condo"];
    }

    return [];
  }

  private detectLifestyleSignals(query: string): string[] {
    const normalized = this.normalize(query);

    return LIFESTYLE_PATTERNS.filter(([, pattern]) => pattern.test(normalized)).map(([signal]) => signal);
  }

  private detectRankingPreferences(query: string): RankingPreferences {
    return {
      preferBeachProximity: /(?:\b(?:close to (?:the )?beach|near (?:the )?beach|walk(?:ing)? distance|beachfront|by the beach)\b|рядом.*пляж|у пляжа|пешком.*пляж|ใกล้.*ชายหาด|ติดทะเล|海边|海邊|海滩附近|海灘附近)/i.test(query),
      preferBudgetPrice: /(?:\b(?:budget-friendly|budget option|cheap|cheaper|affordable|low price|lowest price|economy|inexpensive)\b|бюджетн|дешев|недорог|подешевле|ประหยัด|ถูก|ราคาไม่แพง|便宜|实惠|實惠)/i.test(query),
      preferCarFreeFit: /(?:without a car|no car|don'?t drive|do not drive|walkability|walkable|public transport|baht bus|songthaew|без машины|не вожу|нет машины|пешком|общественный транспорт|маршрутка|сонгтео|ไม่ขับรถ|不用车|不用車|不开车|不開車|公共交通|双条车|雙條車)/i.test(query),
      preferFamilyFit: /(?:school|kindergarten|children|kids|child|family|школ|реб[её]н|детьми|детск|дети|детей|семья|семьи|семье|семью|семей|садик|ครอบครัว|เด็ก|โรงเรียน|家庭|孩子|学校|學校)/i.test(query),
      preferLargerArea: /(?:\b(?:spacious|roomy|large|larger|big|bigger|more space|not tiny|not small)\b|простор|побольше|больш|не маленьк|กว้าง|พื้นที่|宽敞|寬敞|大一点|大一點)/i.test(query),
      preferLuxuryFit: /(?:\b(?:luxury|premium|elite|high-end|upscale|exclusive|best quality)\b|элит|премиум|люкс|дорог|ระดับพรีเมียม|หรู|豪华|豪華|高端)/i.test(query),
      preferNightlifeAccess: /(?:nightlife|adults only|adult only|party|bars?|clubs?|entertainment|walking street|boyz town|ночн|бар|клуб|тусов|развлеч|ปาร์ตี้|บาร์|ผับ|酒吧|夜生活|娱乐|娛樂)/i.test(query),
      preferQuietArea: /(?:quiet|calm|peaceful|тих|спокойн|เงียบ|สงบ|安静|安靜)/i.test(query),
      preferRemoteWorkFit: /(?:internet|coworking|remote|freelance|freelancer|digital nomad|интернет|коворкинг|удален|фриланс|ออนไลน์|เน็ต|远程|遠程|自由职业|自由職業|数字游民|數字遊民|网络|網絡|共享办公|共享辦公)/i.test(query),
      preferRetireeComfort: /(?:retiree|retired|retirement|senior|elderly|пенсионер|пенси[ию]|пожил|เกษียณ|ผู้สูงอายุ|退休|养老|養老|老年)/i.test(query),
      preferValueForMoney: /(?:\b(?:best value|value for money|good deal|best deal|balanced|optimal|worth it)\b|цена.*качество|лучшее предложение|выгод|оптимальн|คุ้มค่า|性价比|性價比)/i.test(query),
      preferWashingMachine: /(?:\b(?:washing machine|washer|laundry machine)\b|стиральн|стиралк|เครื่องซักผ้า|洗衣机|洗衣機)/i.test(query),
      preferWinterStay: /(?:winter|wintering|snowbird|long stay|long-stay|зимовк|зимовать|зиму|зимн|ระยะยาว|过冬|過冬|避寒)/i.test(query)
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

function hasExactBedroomQualifier(query: string, layoutTerm: string): boolean {
  const escapedLayoutTerm = escapeRegExp(layoutTerm.trim());

  return new RegExp(
    `(?:\\b(?:only|exactly|just)\\s+${escapedLayoutTerm}\\b|\\b${escapedLayoutTerm}\\s+(?:only|exactly|just)\\b|только\\s+${escapedLayoutTerm}|${escapedLayoutTerm}\\s+только|именно\\s+${escapedLayoutTerm}|ровно\\s+${escapedLayoutTerm})`,
    "i"
  ).test(query);
}

function hasBedroomLowerBoundQualifier(query: string, layoutTerm: string): boolean {
  const escapedLayoutTerm = escapeRegExp(layoutTerm.trim());

  return new RegExp(
    `(?:\\b${escapedLayoutTerm}\\s*(?:\\+|plus|or more|and more|or above|and above)\\b|\\b(?:at least|minimum|min|from)\\s+${escapedLayoutTerm}\\b|от\\s+${escapedLayoutTerm}|${escapedLayoutTerm}\\s*(?:\\+|или больше|и больше))`,
    "i"
  ).test(query);
}

function isAreaOnlyLocationMention(query: string, targetLabel: string): boolean {
  const areaPattern =
    /\b(?:jomtien|na jomtien|na chom thian|wongamat|pratumnak|pratamnak|phra tamnak|naklua|central pattaya|east pattaya)\b|джомтьен|вонгамат|пратамнак|наклуа|центральная паттайя|จอมเทียน|นาจอมเทียน|วงศ์อมาตย์|นาเกลือ|พระตำหนัก/i;
  const explicitProximityPattern =
    /\b(?:near|close to|next to|walking distance|walkable|within|radius)\b|рядом|возле|около|пешком|в радиусе|ใกล้|เดิน|ภายใน|近|靠近|步行|范围|範圍/i;
  const targetIsAreaLike = /jomtien|wongamat|pratumnak|pratamnak|phra tamnak|naklua|central pattaya|east pattaya/i.test(targetLabel);

  return targetIsAreaLike && areaPattern.test(query) && !explicitProximityPattern.test(query);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  if (filters.kind && property.kind !== filters.kind) {
    return false;
  }

  if (filters.kinds?.length && !filters.kinds.includes(property.kind)) {
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

  if (filters.maxBedrooms !== undefined && property.bedrooms > filters.maxBedrooms) {
    return false;
  }

  if (filters.minAreaSqm !== undefined && property.areaSqm < filters.minAreaSqm) {
    return false;
  }

  if (
    filters.maxBeachDistanceMeters !== undefined &&
    (property.locationFeatures?.nearestBeachDistanceMeters ?? property.beachDistanceMeters ?? Number.POSITIVE_INFINITY) > filters.maxBeachDistanceMeters
  ) {
    return false;
  }

  if (
    filters.maxBahtBusRouteDistanceMeters !== undefined &&
    (property.locationFeatures?.nearestBahtBusRouteDistanceMeters ?? Number.POSITIVE_INFINITY) > filters.maxBahtBusRouteDistanceMeters
  ) {
    return false;
  }

  if (
    filters.maxPublicTransportDistanceMeters !== undefined &&
    (property.locationFeatures?.nearestPublicTransportDistanceMeters ?? Number.POSITIVE_INFINITY) > filters.maxPublicTransportDistanceMeters
  ) {
    return false;
  }

  if (
    filters.maxSupermarketDistanceMeters !== undefined &&
    (property.locationFeatures?.nearestSupermarketDistanceMeters ?? Number.POSITIVE_INFINITY) > filters.maxSupermarketDistanceMeters
  ) {
    return false;
  }

  if (
    filters.maxMallDistanceMeters !== undefined &&
    (property.locationFeatures?.nearestMallDistanceMeters ?? Number.POSITIVE_INFINITY) > filters.maxMallDistanceMeters
  ) {
    return false;
  }

  if (
    filters.maxHospitalDistanceMeters !== undefined &&
    (property.locationFeatures?.nearestHospitalDistanceMeters ?? Number.POSITIVE_INFINITY) > filters.maxHospitalDistanceMeters
  ) {
    return false;
  }

  if (
    filters.maxInternationalSchoolDistanceMeters !== undefined &&
    (property.locationFeatures?.nearestInternationalSchoolDistanceMeters ?? Number.POSITIVE_INFINITY) >
      filters.maxInternationalSchoolDistanceMeters
  ) {
    return false;
  }

  if (
    filters.maxAirportConnectionDistanceMeters !== undefined &&
    (property.locationFeatures?.nearestAirportConnectionDistanceMeters ?? Number.POSITIVE_INFINITY) >
      filters.maxAirportConnectionDistanceMeters
  ) {
    return false;
  }

  if (
    filters.minWalkabilityScore !== undefined &&
    (property.locationFeatures?.walkabilityScore ?? Number.NEGATIVE_INFINITY) < filters.minWalkabilityScore
  ) {
    return false;
  }

  if (filters.near && filters.radiusMeters !== undefined && distanceMeters(property.location, filters.near) > filters.radiusMeters) {
    return false;
  }

  return true;
}

function distanceMeters(from: GeoPoint, to: GeoPoint): number {
  const earthRadiusMeters = 6_371_000;
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function detectRequestedRadiusMeters(query: string): number | undefined {
  const kilometerMatch = query.match(/(?:within|inside|radius|в радиусе|до|ไม่เกิน|ภายใน|范围|範圍)?\s*(\d+(?:[.,]\d+)?)\s*(?:km|kilometers?|км|กม|公里)/i);

  if (kilometerMatch?.[1]) {
    return Math.max(250, Math.min(20_000, Math.round(Number(kilometerMatch[1].replace(",", ".")) * 1000)));
  }

  const meterMatch = query.match(/(?:within|inside|radius|в радиусе|до|ไม่เกิน|ภายใน|范围|範圍)?\s*(\d{3,5})\s*(?:m|meters?|метр|м|เมตร|米)/i);

  if (meterMatch?.[1]) {
    return Math.max(250, Math.min(20_000, Number(meterMatch[1])));
  }

  return undefined;
}

function defaultRadiusMetersForQuery(query: string): number {
  if (/\b(?:walk|walking|walkable|пешком|пешей|เดิน|步行)\b/i.test(query)) {
    return 1000;
  }

  return 3000;
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

  if (preferences.preferCarFreeFit) {
    const carFreeDelta = carFreeFitScore(right) - carFreeFitScore(left);
    if (carFreeDelta !== 0) {
      return carFreeDelta;
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

  if (preferences.preferRemoteWorkFit) {
    const remoteWorkDelta = remoteWorkFitScore(right) - remoteWorkFitScore(left);
    if (remoteWorkDelta !== 0) {
      return remoteWorkDelta;
    }
  }

  if (preferences.preferRetireeComfort) {
    const retireeDelta = retireeComfortScore(right) - retireeComfortScore(left);
    if (retireeDelta !== 0) {
      return retireeDelta;
    }
  }

  if (preferences.preferWinterStay) {
    const winterDelta = winterStayScore(right) - winterStayScore(left);
    if (winterDelta !== 0) {
      return winterDelta;
    }
  }

  if (preferences.preferNightlifeAccess) {
    const nightlifeDelta = nightlifeFitScore(right) - nightlifeFitScore(left);
    if (nightlifeDelta !== 0) {
      return nightlifeDelta;
    }
  }

  if (preferences.preferQuietArea) {
    const quietDelta = quietFitScore(right) - quietFitScore(left);
    if (quietDelta !== 0) {
      return quietDelta;
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
  const carFreeScore = preferences.preferCarFreeFit ? carFreeFitScore(property) / 10 : 0;
  const luxuryScore = preferences.preferLuxuryFit ? luxuryFitScore(property) / 10 : 0;
  const valueScore = preferences.preferValueForMoney ? valueForMoneyScore(property) / 10 : 0;
  const washerScore = preferences.preferWashingMachine && hasAmenity(property, "washing machine") ? 0.4 : 0;
  const familyScore = preferences.preferFamilyFit ? familyFitScore(property) / 10 : 0;
  const remoteWorkScore = preferences.preferRemoteWorkFit ? remoteWorkFitScore(property) / 10 : 0;
  const retireeScore = preferences.preferRetireeComfort ? retireeComfortScore(property) / 10 : 0;
  const winterScore = preferences.preferWinterStay ? winterStayScore(property) / 10 : 0;
  const nightlifeScore = preferences.preferNightlifeAccess ? nightlifeFitScore(property) / 10 : 0;
  const quietScore = preferences.preferQuietArea ? quietFitScore(property) / 10 : 0;
  const areaScore = preferences.preferLargerArea ? Math.min(property.areaSqm / 80, 1) : 0;
  const beachScore =
    preferences.preferBeachProximity && property.beachDistanceMeters !== undefined
      ? Math.max(0, 1 - property.beachDistanceMeters / 3000)
      : 0;

  return Math.min(
      budgetScore +
      carFreeScore +
      luxuryScore +
      valueScore +
      washerScore +
      familyScore +
      remoteWorkScore +
      retireeScore +
      winterScore +
      nightlifeScore +
      quietScore +
      areaScore +
      beachScore,
    1
  );
}

function hasRankingPreferences(preferences: RankingPreferences): boolean {
  return Object.values(preferences).some(Boolean);
}

function describeRankingPreferences(preferences: RankingPreferences): string {
  const labels = [
    preferences.preferBudgetPrice ? "budget price" : undefined,
    preferences.preferCarFreeFit ? "car-free daily living" : undefined,
    preferences.preferLuxuryFit ? "premium fit" : undefined,
    preferences.preferValueForMoney ? "value for money" : undefined,
    preferences.preferWashingMachine ? "washing machine" : undefined,
    preferences.preferFamilyFit ? "family fit" : undefined,
    preferences.preferRemoteWorkFit ? "remote-work fit" : undefined,
    preferences.preferRetireeComfort ? "retiree comfort" : undefined,
    preferences.preferWinterStay ? "winter-stay comfort" : undefined,
    preferences.preferNightlifeAccess ? "nightlife access" : undefined,
    preferences.preferQuietArea ? "quiet area" : undefined,
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

function carFreeFitScore(property: PropertySnapshot): number {
  const features = property.locationFeatures;
  const walkability = Math.min((features?.walkabilityScore ?? 0) / 10, 10);
  const supermarketScore = distanceScore(features?.nearestSupermarketDistanceMeters, 1200) * 3;
  const transportDistance = Math.min(
    features?.nearestBahtBusRouteDistanceMeters ?? Number.POSITIVE_INFINITY,
    features?.nearestPublicTransportDistanceMeters ?? Number.POSITIVE_INFINITY
  );
  const transportScore = distanceScore(Number.isFinite(transportDistance) ? transportDistance : undefined, 900) * 3;
  const mallScore = distanceScore(features?.nearestMallDistanceMeters, 3000) * 1.5;
  const beachScore = distanceScore(features?.nearestBeachDistanceMeters ?? property.beachDistanceMeters, 1200);

  return walkability * 0.35 + supermarketScore + transportScore + mallScore + beachScore;
}

function distanceScore(distanceMeters: number | undefined, comfortableDistanceMeters: number): number {
  if (distanceMeters === undefined) {
    return 0;
  }

  return Math.max(0, 1 - distanceMeters / comfortableDistanceMeters);
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

function remoteWorkFitScore(property: PropertySnapshot): number {
  const remoteAmenityScore = countAmenityMatches(property, [
    "fast-internet",
    "fiber-internet",
    "high-speed internet",
    "coworking",
    "coworking space",
    "workspace",
    "desk"
  ]);

  return remoteAmenityScore * 2.5 + Math.min(property.areaSqm / 30, 3) + (property.bedrooms >= 1 ? 1 : 0);
}

function retireeComfortScore(property: PropertySnapshot): number {
  const comfortAmenityScore = countAmenityMatches(property, [
    "elevator",
    "lift",
    "24h security",
    "security",
    "covered parking",
    "shuttle service",
    "garden",
    "pool",
    "gym"
  ]);
  const floorComfort = property.floor === undefined ? 0 : property.floor <= 8 ? 1 : 0.3;

  return comfortAmenityScore * 1.6 + Math.min(property.areaSqm / 35, 3) + floorComfort;
}

function winterStayScore(property: PropertySnapshot): number {
  const longStayAmenityScore = countAmenityMatches(property, [
    "washing machine",
    "balcony",
    "pool",
    "gym",
    "fast-internet",
    "fiber-internet",
    "high-speed internet",
    "coworking",
    "covered parking"
  ]);
  const beachScore = property.beachDistanceMeters === undefined ? 0 : property.beachDistanceMeters <= 1500 ? 1.5 : 0;

  return longStayAmenityScore * 1.4 + Math.min(property.areaSqm / 35, 3) + beachScore;
}

function nightlifeFitScore(property: PropertySnapshot): number {
  const searchableText = `${property.title} ${property.address ?? ""} ${property.amenities.join(" ")}`.toLowerCase();
  const areaScore = /central|walking street|boyz town|nightlife|bar|club|entertainment|pattaya beach/i.test(searchableText) ? 4 : 0;
  const convenienceScore = countAmenityMatches(property, ["covered parking", "shuttle service", "24h security", "security"]) * 1.2;

  return areaScore + convenienceScore + (property.bedrooms <= 1 ? 1 : 0);
}

function quietFitScore(property: PropertySnapshot): number {
  const searchableText = `${property.title} ${property.address ?? ""} ${property.amenities.join(" ")}`.toLowerCase();
  const quietSignal = /quiet|calm|garden|resort|family|jomtien|naklua|pratumnak|huai yai/i.test(searchableText) ? 3 : 0;
  const centralPenalty = /walking street|boyz town|nightlife|bar|club/i.test(searchableText) ? -2 : 0;

  return quietSignal + centralPenalty + countAmenityMatches(property, ["garden", "24h security", "security"]) * 1.2;
}

function countAmenityMatches(property: PropertySnapshot, requestedAmenities: string[]): number {
  return requestedAmenities.filter((amenity) => property.amenities.some((propertyAmenity) => propertyAmenity.toLowerCase() === amenity)).length;
}

function hasAmenity(property: PropertySnapshot, amenity: string): boolean {
  return property.amenities.some((propertyAmenity) => propertyAmenity.toLowerCase() === amenity);
}
