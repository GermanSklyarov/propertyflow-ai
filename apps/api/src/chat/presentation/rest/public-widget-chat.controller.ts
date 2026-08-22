import { BadRequestException, Body, Controller, Headers, Inject, Logger, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type {
  PublicWidgetAskResponse,
  PublicWidgetLeadResponse,
  PublicWidgetMessengerHandoffResponse,
  PublicWidgetRecommendedListing,
  TenantSnapshot,
  AiChatCitation,
  AiChatReferencedListing,
  AiChatTurn,
  LeadStatus,
  TenantWidgetLanguage
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { LeadService } from "../../../leads/application/lead.service.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../../properties/domain/property.repository.js";
import { TenantService } from "../../../tenants/application/tenant.service.js";
import type { AiConciergePersona } from "../../application/ai-text-generator.js";
import { AiChatService } from "../../application/ai-chat.service.js";
import { planAiChatRetrieval } from "../../application/ai-chat-retrieval-plan.js";
import { LocationIntelligenceService } from "../../application/location-intelligence.js";
import { PublicWidgetMessengerHandoffService } from "../../application/public-widget-messenger-handoff.service.js";
import { PublicWidgetRateLimitService } from "../../application/public-widget-rate-limit.service.js";
import { PublicWidgetAskDto, PublicWidgetLeadDto, PublicWidgetMessengerHandoffDto } from "./public-widget-chat.dto.js";

interface PublicWidgetRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
}

interface PublicWidgetRecommendationBundle {
  candidateMatches?: number;
  fitSummary: string;
  listings: PublicWidgetRecommendedListing[];
  locationTarget?: WidgetLocationTarget;
  totalMatches?: number;
}

type WidgetPriceMode = "rent" | "sale";
const WIDGET_AREA_MATCH_RADIUS_METERS = 2_500;

interface WidgetLocationTarget {
  aliases: string[];
  kind?: "area" | "poi";
  label: string;
  latitude: number;
  longitude: number;
  matchRadiusMeters?: number;
}

const WIDGET_LOCATION_TARGETS: Partial<Record<PropertySnapshot["market"], WidgetLocationTarget[]>> = {
  pattaya: [
    {
      aliases: ["central pattaya", "central festival", "central pattaya mall", "центр паттайи", "центральная паттайя"],
      kind: "area",
      label: "Central Pattaya",
      latitude: 12.9348,
      matchRadiusMeters: WIDGET_AREA_MATCH_RADIUS_METERS,
      longitude: 100.8832
    },
    {
      aliases: [
        "pratumnak",
        "pratamnak",
        "phra tamnak",
        "phra tamnak hill",
        "pratumnak hill",
        "пратамнак",
        "пратамнаке",
        "пратамнака"
      ],
      kind: "area",
      label: "Pratumnak",
      latitude: 12.9156,
      matchRadiusMeters: WIDGET_AREA_MATCH_RADIUS_METERS,
      longitude: 100.8624
    },
    {
      aliases: ["jomtien", "jomtien beach", "จอมเทียน", "หาดจอมเทียน", "джомтьен", "джомтьене", "джомтьена"],
      kind: "area",
      label: "Jomtien",
      latitude: 12.8958,
      matchRadiusMeters: WIDGET_AREA_MATCH_RADIUS_METERS,
      longitude: 100.8745
    },
    {
      aliases: ["na jomtien", "na chom thian", "najomtien", "นาจอมเทียน"],
      kind: "area",
      label: "Na Jomtien",
      latitude: 12.843,
      matchRadiusMeters: WIDGET_AREA_MATCH_RADIUS_METERS,
      longitude: 100.909
    },
    {
      aliases: ["wongamat", "wongamat beach", "วงศ์อมาตย์", "หาดวงศ์อมาตย์", "вонгамат", "вонгамате", "вонгамата"],
      kind: "area",
      label: "Wongamat",
      latitude: 12.9696,
      matchRadiusMeters: WIDGET_AREA_MATCH_RADIUS_METERS,
      longitude: 100.8855
    },
    {
      aliases: ["naklua", "na kluea", "นาเกลือ", "наклуа", "наклыа"],
      kind: "area",
      label: "Naklua",
      latitude: 12.974,
      matchRadiusMeters: WIDGET_AREA_MATCH_RADIUS_METERS,
      longitude: 100.903
    },
    {
      aliases: ["north pattaya", "พัทยาเหนือ", "северная паттайя", "север паттайи"],
      kind: "area",
      label: "North Pattaya",
      latitude: 12.955,
      matchRadiusMeters: WIDGET_AREA_MATCH_RADIUS_METERS,
      longitude: 100.889
    },
    {
      aliases: ["south pattaya", "พัทยาใต้", "южная паттайя", "юг паттайи"],
      kind: "area",
      label: "South Pattaya",
      latitude: 12.923,
      matchRadiusMeters: WIDGET_AREA_MATCH_RADIUS_METERS,
      longitude: 100.882
    },
    {
      aliases: ["east pattaya", "dark side", "พัทยาตะวันออก", "восточная паттайя", "восток паттайи"],
      kind: "area",
      label: "East Pattaya",
      latitude: 12.929,
      matchRadiusMeters: 4_000,
      longitude: 100.93
    },
    {
      aliases: ["huai yai", "ห้วยใหญ่", "хуай яй", "хуай-яй"],
      kind: "area",
      label: "Huai Yai",
      latitude: 12.845,
      matchRadiusMeters: 4_000,
      longitude: 100.949
    },
    {
      aliases: ["bang saray", "bangsaray", "บางเสร่", "банг сарай", "бангсарай"],
      kind: "area",
      label: "Bang Saray",
      latitude: 12.764,
      matchRadiusMeters: 4_000,
      longitude: 100.897
    },
    {
      aliases: ["phoenix", "phoenix golf", "ฟีนิกซ์", "феникс"],
      kind: "area",
      label: "Phoenix",
      latitude: 12.837,
      matchRadiusMeters: 4_000,
      longitude: 100.964
    },
    {
      aliases: ["mabprachan", "map prachan", "мабпрачан", "мапрачан", "มาบประชัน"],
      kind: "area",
      label: "Mabprachan",
      latitude: 12.954,
      matchRadiusMeters: 4_000,
      longitude: 100.98
    },
    {
      aliases: ["nong prue", "หนองปรือ", "нонг пру", "нонгпру"],
      kind: "area",
      label: "Nong Prue",
      latitude: 12.92,
      matchRadiusMeters: 4_000,
      longitude: 100.949
    },
    {
      aliases: ["sattahip", "สัตหีบ", "саттахип"],
      kind: "area",
      label: "Sattahip",
      latitude: 12.666,
      matchRadiusMeters: 5_000,
      longitude: 100.901
    },
    {
      aliases: ["walking street", "pattaya walking street"],
      kind: "poi",
      label: "Walking Street",
      latitude: 12.9279,
      longitude: 100.8738
    },
    {
      aliases: ["boyz town", "boyztown", "boys town"],
      kind: "poi",
      label: "Boyz Town",
      latitude: 12.9298,
      longitude: 100.8789
    },
    {
      aliases: ["asia pattaya hotel", "asia pattaya beach hotel", "asia hotel pattaya", "отель asia pattaya", "азия паттайя отель"],
      kind: "poi",
      label: "Asia Pattaya Hotel",
      latitude: 12.914206,
      longitude: 100.858419
    },
    {
      aliases: ["terminal 21", "terminal 21 pattaya"],
      kind: "poi",
      label: "Terminal 21 Pattaya",
      latitude: 12.9497,
      longitude: 100.889
    },
    {
      aliases: ["ramayana water park", "water park ramayana", "ramayana", "аквапарк рамаяна", "рамаяна"],
      kind: "poi",
      label: "Ramayana Water Park",
      latitude: 12.75045,
      longitude: 100.96204
    }
  ]
};

@Controller("public/v1/widget")
@ApiTags("public-widget")
export class PublicWidgetChatController {
  private readonly logger = new Logger(PublicWidgetChatController.name);

  constructor(
    @Inject(TenantService) private readonly tenants: TenantService,
    @Inject(AiChatService) private readonly chat: AiChatService,
    @Inject(LeadService) private readonly leads: LeadService,
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(PublicWidgetRateLimitService) private readonly rateLimits: PublicWidgetRateLimitService,
    @Inject(LocationIntelligenceService)
    private readonly locationIntelligence: LocationIntelligenceService = new LocationIntelligenceService(),
    @Inject(PublicWidgetMessengerHandoffService)
    private readonly messengerHandoffs: PublicWidgetMessengerHandoffService = undefined as never
  ) {}

  @Post("ask/:tenantSlug")
  @ApiOperation({ summary: "Ask the public AI Concierge widget a tenant-scoped question" })
  @ApiParam({ name: "tenantSlug", example: "demo-agency" })
  @ApiOkResponse({
    description: "Grounded AI Concierge answer for an embedded public widget",
    schema: {
      example: {
        id: "advice-1",
        answer: "I found 2 matching listings. Top matches: Wongamat Sea View Residence...",
        citations: [{ label: "Wongamat Sea View Residence, pattaya, 3500000 THB", source: "property" }],
        conciergeMode: "starter",
        createdAt: "2026-07-21T00:00:00.000Z",
        insights: [
          {
            detail: "Ask whether the sea view is protected from future construction before recommending.",
            kind: "due_diligence",
            propertyId: "10000000-0000-4000-8000-000000000001",
            severity: "info",
            title: "Ask before recommending"
          }
        ],
        locale: "en",
        matchedPropertyIds: ["10000000-0000-4000-8000-000000000001"],
        message: "condo in pattaya under 5M with sea view",
        suggestedActions: ["compare-results", "open-map", "save-search"],
        tenantSlug: "demo-agency"
      }
    }
  })
  async ask(
    @Param("tenantSlug") tenantSlug: string,
    @Body() payload: PublicWidgetAskDto,
    @Req() request: PublicWidgetRequest,
    @Headers("origin") origin?: string,
    @Headers("referer") referer?: string
  ): Promise<PublicWidgetAskResponse> {
    const startedAt = Date.now();
    const tenant = await this.tenants.getActiveTenantBySlugOrThrow(tenantSlug, "Widget tenant not found");
    assertPublicWidgetAskPayloadBounds(payload);
    this.tenants.assertPublicWidgetOriginAllowed(tenant, origin, referer);
    await this.rateLimits.checkPublicWidgetAsk({
      ip: resolveClientIp(request),
      sessionId: payload.sessionId,
      tenantId: tenant.id
    });
    const guardMs = Date.now() - startedAt;

    const locale = resolveWidgetLocale(tenant.widget.languages, payload.locale);
    const chatStartedAt = Date.now();
    const response = await this.chat.ask(
      tenant.id,
      {
        conversation: payload.conversation,
        locale,
        market: payload.market,
        message: payload.message,
        propertyId: payload.propertyId,
        purpose: payload.purpose
      },
      {
        persona: resolveWidgetPersona(tenant, locale)
      }
    );
    const chatMs = Date.now() - chatStartedAt;
    const recordStartedAt = Date.now();
    await this.tenants.recordPublicWidgetAsk(tenant, {
      locale,
      origin: origin ?? null,
      referer: referer ?? null,
      sessionId: payload.sessionId ?? null
    });
    const recordMs = Date.now() - recordStartedAt;
    const recommendationsStartedAt = Date.now();
    const recommendations = await this.buildRecommendedListings(
      tenant,
      response.matchedPropertyIds,
      origin,
      referer,
      locale,
      payload
    );
    const recommendationsMs = Date.now() - recommendationsStartedAt;
    const totalMs = Date.now() - startedAt;

    if (totalMs >= 1_000) {
      this.logger.warn(
        `Slow public widget ask tenant=${tenant.id} mode=${response.generation?.mode ?? "unknown"} guardMs=${guardMs} chatMs=${chatMs} recordMs=${recordMs} recommendationsMs=${recommendationsMs} totalMs=${totalMs}`
      );
    }

    return {
      ...response,
      answer: normalizePublicWidgetAnswer(
        response.answer,
        recommendations,
        locale,
        response.suggestedActions,
        payload.message,
        response.citations
      ),
      conciergeMode: tenant.subscriptionPlan,
      locale,
      recommendedListings: recommendations.listings,
      tenantSlug: tenant.slug
    };
  }

  @Post("leads/:tenantSlug")
  @ApiOperation({ summary: "Create a tenant-scoped qualified lead from the public AI Concierge widget" })
  @ApiParam({ name: "tenantSlug", example: "demo-agency" })
  @ApiOkResponse({
    description: "Qualified lead captured from a public widget handoff without exposing a public API key",
    schema: {
      example: {
        conciergeMode: "growth",
        leadId: "lead-1",
        locale: "en",
        message: "Thanks. The agency has your qualified request and can follow up.",
        status: "new",
        tenantSlug: "demo-agency"
      }
    }
  })
  async createLead(
    @Param("tenantSlug") tenantSlug: string,
    @Body() payload: PublicWidgetLeadDto,
    @Headers("origin") origin?: string,
    @Headers("referer") referer?: string
  ): Promise<PublicWidgetLeadResponse> {
    const tenant = await this.tenants.getActiveTenantBySlugOrThrow(tenantSlug, "Widget tenant not found");
    this.tenants.assertPublicWidgetOriginAllowed(tenant, origin, referer);

    const locale = resolveWidgetLocale(tenant.widget.languages, payload.locale);
    const contactEmail = normalizeOptional(payload.contactEmail);
    const contactPhone = normalizeOptional(payload.contactPhone);
    const propertyId = resolveLeadPropertyId(payload);
    const status = assessWidgetLeadStatus(payload, { contactEmail, contactPhone, propertyId });

    if (!contactEmail && !contactPhone) {
      throw new BadRequestException("Email or phone is required for widget handoff");
    }

    const lead = await this.leads.create(tenant.id, {
      contactEmail,
      contactName: payload.contactName.trim(),
      contactPhone,
      message: buildQualifiedLeadMessage(payload, propertyId),
      preferredLocale: locale,
      propertyId,
      source: "ai-concierge",
      status
    });

    return {
      conciergeMode: tenant.subscriptionPlan,
      leadId: lead.id,
      locale,
      message: buildWidgetLeadSuccessMessage(locale, tenant.subscriptionPlan),
      status: lead.status,
      tenantSlug: tenant.slug
    };
  }

  @Post("handoff/:tenantSlug")
  @ApiOperation({ summary: "Create a messenger continuation link for the public AI Concierge widget" })
  @ApiParam({ name: "tenantSlug", example: "demo-agency" })
  @ApiOkResponse({
    description: "Messenger deep links that preserve the current public widget conversation context",
    schema: {
      example: {
        conciergeMode: "starter",
        locale: "ru",
        options: [
          {
            expiresAt: "2026-09-03T00:00:00.000Z",
            provider: "telegram",
            status: "available",
            url: "https://t.me/demo_propertyflow_bot?start=pf_token"
          }
        ],
        tenantSlug: "demo-agency"
      }
    }
  })
  async createMessengerHandoff(
    @Param("tenantSlug") tenantSlug: string,
    @Body() payload: PublicWidgetMessengerHandoffDto,
    @Headers("origin") origin?: string,
    @Headers("referer") referer?: string
  ): Promise<PublicWidgetMessengerHandoffResponse> {
    const tenant = await this.tenants.getActiveTenantBySlugOrThrow(tenantSlug, "Widget tenant not found");
    assertPublicWidgetConversationBounds(payload.conversation);
    this.tenants.assertPublicWidgetOriginAllowed(tenant, origin, referer);

    return this.messengerHandoffs.createHandoff(tenant, payload);
  }

  private async buildRecommendedListings(
    tenant: TenantSnapshot,
    propertyIds: string[],
    origin?: string,
    referer?: string,
    locale: TenantWidgetLanguage = "en",
    payload?: PublicWidgetAskDto
  ): Promise<PublicWidgetRecommendationBundle> {
    const baseOrigin = resolveRequestOrigin(origin) ?? resolveRequestOrigin(referer);
    const listingUrlTemplate = normalizeListingUrlTemplate(tenant.widget.listingUrlTemplate);

    if (!baseOrigin) {
      return {
        candidateMatches: propertyIds.length,
        fitSummary: "",
        listings: [],
        totalMatches: propertyIds.length
      };
    }

    const excludedPropertyIds =
      payload && isMoreListingsRequest(payload.message) && !isAllListingsRequest(payload.message)
        ? getShownListingIds(payload.conversation)
        : new Set<string>();
    const visiblePropertyIds = propertyIds.filter((propertyId) => !excludedPropertyIds.has(propertyId));
    const idsToLoad = visiblePropertyIds.length ? visiblePropertyIds : propertyIds;
    const properties = await Promise.all(idsToLoad.slice(0, 8).map((propertyId) => this.properties.findById(tenant.id, propertyId)));
    const searchContext = buildWidgetSearchContextMessage(payload);
    const publicProperties = properties
      .filter((property): property is PropertySnapshot => Boolean(property))
      .filter(isPublicWidgetRecommendableProperty);
    const listingIntentMatchedProperties = filterByWidgetListingIntent(publicProperties, searchContext);
    const kindMatchedProperties = filterByWidgetKindRequirements(listingIntentMatchedProperties, searchContext);
    const layoutMatchedProperties = filterByWidgetLayoutRequirements(kindMatchedProperties, searchContext);
    const strictPublicProperties = filterByRequiredWidgetAmenities(layoutMatchedProperties, searchContext);
    const locationTarget = await this.resolveWidgetLocationTarget(searchContext, publicProperties[0]?.market ?? payload?.market);
    const locationMatchedProperties = filterByWidgetLocationTarget(strictPublicProperties, locationTarget);
    const rankedPublicProperties = rankWidgetPropertiesForRequest(locationMatchedProperties, searchContext, locationTarget);
    const matchedProperties = rankedPublicProperties.slice(0, 3);

    return {
      candidateMatches: visiblePropertyIds.length,
      fitSummary: buildListingFitSummary(matchedProperties, locale, resolveWidgetPriceMode(searchContext), searchContext, locationTarget),
      listings: matchedProperties.map((property) => ({
        propertyId: property.id,
        title: property.title,
        url: buildListingUrl(baseOrigin, listingUrlTemplate, property.id)
      })),
      locationTarget,
      totalMatches: locationMatchedProperties.length
    };
  }

  private async resolveWidgetLocationTarget(
    message: string,
    market?: PropertySnapshot["market"]
  ): Promise<WidgetLocationTarget | undefined> {
    const staticTarget = resolveStaticWidgetLocationTarget(message, market);
    if (staticTarget) {
      return staticTarget;
    }

    const target = await this.locationIntelligence.resolveComparisonTarget(message, market);
    if (!target || target.kind !== "poi") {
      return undefined;
    }

    return {
      aliases: target.poi.aliases,
      kind: "poi",
      label: target.poi.label,
      latitude: target.poi.location.latitude,
      longitude: target.poi.location.longitude
    };
  }
}

function buildWidgetSearchContextMessage(payload?: PublicWidgetAskDto): string {
  const recentUserMessages = (payload?.conversation ?? [])
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.text.trim())
    .filter(Boolean)
    .slice(-4);
  const currentMessage = payload?.message?.trim();

  return [...recentUserMessages, ...(currentMessage ? [currentMessage] : [])].join(". ");
}

function getShownListingIds(conversation?: AiChatTurn[]): Set<string> {
  return new Set(
    (conversation ?? [])
      .flatMap((turn) => [
        ...(turn.recommendedListings ?? []).map((listing) => listing.propertyId),
        ...extractListingIdsFromText(turn.text)
      ])
      .map((propertyId) => propertyId.trim())
      .filter(Boolean)
  );
}

function extractListingIdsFromText(text: string): string[] {
  return Array.from(
    text.matchAll(/\/listings\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi),
    (match) => match[1] ?? ""
  );
}

function resolveWidgetLocale(enabledLanguages: TenantWidgetLanguage[], requestedLocale: TenantWidgetLanguage): TenantWidgetLanguage {
  if (enabledLanguages.includes(requestedLocale)) {
    return requestedLocale;
  }

  return enabledLanguages[0] ?? "en";
}

function buildWidgetLeadSuccessMessage(locale: TenantWidgetLanguage, subscriptionPlan: TenantSnapshot["subscriptionPlan"]): string {
  const starterLabels: Record<TenantWidgetLanguage, string> = {
    en: "Thanks. The agency has your qualified request and can follow up.",
    ru: "Спасибо. Агентство получило ваш запрос и сможет связаться с вами.",
    th: "ขอบคุณค่ะ เอเจนซี่ได้รับคำขอของคุณแล้วและจะติดต่อกลับ",
    zh: "谢谢。机构已收到您的需求，并会跟进。"
  };
  const crmLabels: Record<TenantWidgetLanguage, string> = {
    en: "Thanks. The agency has your request and can follow up from CRM.",
    ru: "Спасибо. Агентство получило ваш запрос и сможет обработать его в CRM.",
    th: "ขอบคุณค่ะ เอเจนซี่ได้รับคำขอของคุณแล้วและจะติดตามต่อใน CRM",
    zh: "谢谢。机构已收到您的请求，并可在 CRM 中跟进。"
  };
  const labels = subscriptionPlan === "starter" ? starterLabels : crmLabels;

  return labels[locale] ?? labels.en;
}

function normalizePublicWidgetAnswer(
  answer: string,
  recommendations: PublicWidgetRecommendationBundle,
  locale: TenantWidgetLanguage,
  suggestedActions: string[],
  requestMessage = "",
  citations: AiChatCitation[] = []
): string {
  const normalizedAnswer = stripMarkdownEmphasis(answer).trim();

  if (!recommendations.listings.length && isListingCardSearchResponse(suggestedActions)) {
    return buildNoPublicListingCardsMessage(locale, requestMessage, citations, recommendations.locationTarget);
  }

  if (!recommendations.listings.length || !isListingDiscoveryResponse(suggestedActions)) {
    return normalizedAnswer;
  }

  return [
    buildListingCardIntro(
      normalizedAnswer,
      recommendations.listings.length,
      locale,
      recommendations.totalMatches,
      recommendations.candidateMatches,
      isMoreListingsRequest(requestMessage) && !isAllListingsRequest(requestMessage)
    ),
    recommendations.fitSummary
  ]
    .filter(Boolean)
    .join("\n\n");
}

function isListingDiscoveryResponse(suggestedActions: string[]): boolean {
  return suggestedActions.includes("save-search");
}

function isListingCardSearchResponse(suggestedActions: string[]): boolean {
  return isListingDiscoveryResponse(suggestedActions) || suggestedActions.includes("relax-filters");
}

function buildNoPublicListingCardsMessage(
  locale: TenantWidgetLanguage,
  requestMessage: string,
  citations: AiChatCitation[],
  locationTarget?: WidgetLocationTarget
): string {
  const target = locationTarget ?? resolveStaticWidgetLocationTarget(requestMessage);
  const mapWasApplied = citations.some((citation) => /map geocoding resolved|radiusMeters|geo filtering/i.test(citation.label));

  if (target) {
    const labels: Record<TenantWidgetLanguage, string> = {
      en: mapWasApplied
        ? `I recognized ${target.label} on the map and applied location filtering, but I do not have public condo cards that match this request within the current radius. This likely means the current inventory has no suitable condos close enough. I can broaden the radius or hand this to an agent for off-market options.`
        : `I do not have public condo cards that match this request near ${target.label} right now. I can broaden the radius or hand this to an agent for off-market options.`,
      ru: mapWasApplied
        ? `Я распознала ${target.label} на карте и применила фильтр по расстоянию, но сейчас нет публичных карточек кондо, которые подходят под запрос в текущем радиусе. Скорее всего, в текущем инвентаре нет подходящих объектов достаточно близко. Можно расширить радиус или передать запрос агенту для off-market вариантов.`
        : `Сейчас нет публичных карточек кондо рядом с ${target.label} под этот запрос. Можно расширить радиус или передать запрос агенту для off-market вариантов.`,
      th: mapWasApplied
        ? `ฉันระบุตำแหน่ง ${target.label} บนแผนที่และใช้ตัวกรองระยะทางแล้ว แต่ตอนนี้ยังไม่มีการ์ดคอนโดสาธารณะที่ตรงกับคำขอในรัศมีปัจจุบัน น่าจะหมายความว่า inventory ปัจจุบันไม่มีตัวเลือกที่ใกล้พอ สามารถขยายรัศมีหรือส่งต่อให้เอเจนต์หา off-market ได้`
        : `ตอนนี้ยังไม่มีการ์ดคอนโดสาธารณะที่ตรงกับคำขอใกล้ ${target.label} สามารถขยายรัศมีหรือส่งต่อให้เอเจนต์หา off-market ได้`,
      zh: mapWasApplied
        ? `我已在地图中识别 ${target.label} 并应用距离筛选，但当前半径内没有符合条件的公开公寓卡片。这通常表示当前库存里没有足够近的合适房源。可以扩大半径，或交给经纪人寻找 off-market 选项。`
        : `目前没有符合这个需求且靠近 ${target.label} 的公开公寓卡片。可以扩大半径，或交给经纪人寻找 off-market 选项。`
    };

    return labels[locale] ?? labels.en;
  }

  if (isStrictStudioRequest(requestMessage)) {
    return buildNoStrictStudioCardsMessage(locale, requestMessage);
  }

  const labels: Record<TenantWidgetLanguage, string> = {
    en: "I do not have public listing cards to show for this exact search right now. You can adjust the budget, area, radius, or requirements and I can look again.",
    ru: "Сейчас нет публичных карточек под этот точный поиск. Можно изменить бюджет, район, радиус или требования, и я поищу заново.",
    th: "ตอนนี้ยังไม่มีการ์ดประกาศสาธารณะที่ตรงกับการค้นหานี้ ลองปรับงบ ทำเล รัศมี หรือเงื่อนไข แล้วฉันจะค้นหาให้อีกครั้ง",
    zh: "目前没有符合这个精确搜索的公开房源卡片。你可以调整预算、区域、半径或条件，我再帮你查找。"
  };

  return labels[locale] ?? labels.en;
}

function buildNoStrictStudioCardsMessage(locale: TenantWidgetLanguage, requestMessage: string): string {
  const intent = detectWidgetListingIntent(requestMessage);
  const hasBudget = hasBudgetSignal(requestMessage);
  const hasLocation = hasSpecificLocationPreference(requestMessage);
  const knownCriteria = [
    intent === "rent" ? "rent" : intent === "sale" ? "purchase" : undefined,
    hasBudget ? "budget" : undefined,
    hasLocation ? "location/beach preference" : undefined
  ].filter(Boolean);
  const followUpEn = hasBudget && intent
    ? "The useful next step is to loosen one constraint: allow studio or 1-bedroom, widen the beach distance/area, or ask an agent to check off-market studios in that budget."
    : hasBudget
      ? "I still need to know whether this is rent or purchase; otherwise you can loosen to studio or 1-bedroom or ask an agent for off-market studios."
      : intent
        ? "Please share the budget, or loosen to studio or 1-bedroom, so I can avoid showing random cards."
        : "Please share whether you want to rent or buy and your budget, or loosen to studio or 1-bedroom.";
  const followUpRu = hasBudget && intent
    ? "Следующий полезный шаг - ослабить одно условие: разрешить studio or 1-bedroom, расширить расстояние до пляжа/район или попросить агента проверить off-market студии в этом бюджете."
    : hasBudget
      ? "Ещё нужно понять, аренда это или покупка; иначе можно расширить до studio or 1-bedroom или попросить агента найти off-market студии."
      : intent
        ? "Укажите бюджет или расширьте до studio or 1-bedroom, чтобы я не показывала случайные карточки."
        : "Укажите, аренда это или покупка, и бюджет, либо расширьте планировку до studio or 1-bedroom.";
  const followUpTh = hasBudget && intent
    ? "ขั้นตอนถัดไปที่มีประโยชน์คือผ่อนเงื่อนไขหนึ่งข้อ: อนุญาตสตูดิโอหรือ 1 ห้องนอน ขยายระยะถึงชายหาด/โซน หรือให้เอเจนต์เช็ก off-market studio ในงบนี้"
    : hasBudget
      ? "ยังต้องทราบว่าต้องการเช่าหรือซื้อ หรือผ่อนเป็นสตูดิโอ/1 ห้องนอน หรือให้เอเจนต์หา off-market studio"
      : intent
        ? "โปรดระบุงบ หรือผ่อนเป็นสตูดิโอ/1 ห้องนอน เพื่อไม่ให้ฉันแสดงการ์ดแบบสุ่ม"
        : "โปรดระบุว่าต้องการเช่าหรือซื้อและงบ หรือผ่อนเงื่อนไขเป็นสตูดิโอ/1 ห้องนอน";
  const followUpZh = hasBudget && intent
    ? "下一步最好放宽一个条件：允许 studio 或一居室、扩大海滩距离/区域，或让经纪人按这个预算查找 off-market studio。"
    : hasBudget
      ? "还需要确认是租还是买；也可以放宽为 studio 或一居室，或让经纪人查找 off-market studio。"
      : intent
        ? "请补充预算，或放宽为 studio 或一居室，这样我不会展示随机卡片。"
        : "请补充是租还是买以及预算，或放宽为 studio 或一居室。";

  const labels: Record<TenantWidgetLanguage, string> = {
    en: `I do not have public studio cards that match this exact search right now${knownCriteria.length ? ` (${knownCriteria.join(", ")} noted)` : ""}. I should not substitute 1-bedroom condos as studios. ${followUpEn}`,
    ru: `Сейчас нет публичных карточек студий под этот точный поиск${knownCriteria.length ? ` (${knownCriteria.join(", ")} уже учтено)` : ""}. Я не должна подменять студии 1-bedroom кондо. ${followUpRu}`,
    th: `ตอนนี้ยังไม่มีการ์ดสตูดิโอสาธารณะที่ตรงกับการค้นหานี้${knownCriteria.length ? ` (รับข้อมูล ${knownCriteria.join(", ")} แล้ว)` : ""} ฉันไม่ควรแทนสตูดิโอด้วยห้อง 1 ห้องนอน ${followUpTh}`,
    zh: `目前没有符合这个精确搜索的公开 studio 卡片${knownCriteria.length ? `（已记录 ${knownCriteria.join(", ")}）` : ""}。我不应把一居室当作 studio 替代。${followUpZh}`
  };

  return labels[locale] ?? labels.en;
}

function isMoreListingsRequest(message: string): boolean {
  return /\b(?:more|another|other|else|all|everything|show\s+all|see\s+all)\b|\bnext\s+(?:options?|listings?|ones?)\b|еще|ещё|друг|остальн|все вариант|покажи все|เพิ่มเติม|ทั้งหมด|其他|更多|全部|所有/i.test(
    message
  );
}

function isAllListingsRequest(message: string): boolean {
  return /\b(?:all|everything|show\s+all|see\s+all)\b|все вариант|покажи все|ทั้งหมด|全部|所有/i.test(message);
}

function stripMarkdownEmphasis(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1");
}

function buildListingCardIntro(
  answer: string,
  shownCount: number,
  locale: TenantWidgetLanguage,
  totalMatches?: number,
  candidateMatches?: number,
  isMoreRequest = false
): string {
  const parsedMatchCountValue = Number(answer.match(/\b(\d{1,4})\b/)?.[1]);
  const parsedMatchCount = Number.isFinite(parsedMatchCountValue) ? parsedMatchCountValue : undefined;
  const publicMatchCount = Math.max(totalMatches ?? shownCount, shownCount);
  const shouldUsePublicCount =
    parsedMatchCount === undefined ||
    parsedMatchCount < shownCount ||
    parsedMatchCount > publicMatchCount ||
    (candidateMatches !== undefined && parsedMatchCount === candidateMatches && publicMatchCount < candidateMatches);
  const countText = String(shouldUsePublicCount ? publicMatchCount : parsedMatchCount);
  if (isMoreRequest) {
    const moreLabels: Record<TenantWidgetLanguage, string> = {
      en: `Showing the next ${shownCount} option${shownCount === 1 ? "" : "s"} that still match your previous request.`,
      ru: `Показываю следующие ${shownCount} вариант${shownCount === 1 ? "" : "а"}, которые всё ещё подходят под ваш запрос.`,
      th: `กำลังแสดงอีก ${shownCount} ตัวเลือกถัดไปที่ยังตรงกับคำขอก่อนหน้า`,
      zh: `继续显示接下来 ${shownCount} 个仍符合上一条需求的选项。`
    };

    return moreLabels[locale] ?? moreLabels.en;
  }

  const labels: Record<TenantWidgetLanguage, string> = {
    en: `I found ${countText} matching listing${countText === "1" ? "" : "s"}. ${
      shownCount === 1 ? "Here is the top match I can show now." : `Here are the top ${shownCount} I can show now.`
    }`,
    ru:
      countText === "1"
        ? "Я нашла 1 подходящий вариант. Ниже лучший вариант, который можно открыть сейчас."
        : `Я нашла ${countText} подходящих вариантов. Ниже топ-${shownCount}, которые можно открыть сейчас.`,
    th: `พบรายการที่ตรงกับคำขอ ${countText} รายการ ด้านล่างคือ ${shownCount} รายการเด่นที่เปิดดูได้ตอนนี้`,
    zh: `我找到了 ${countText} 个匹配房源。下面是现在可以打开查看的前 ${shownCount} 个。`
  };

  return labels[locale] ?? labels.en;
}

function buildListingFitSummary(
  properties: PropertySnapshot[],
  locale: TenantWidgetLanguage,
  priceMode: WidgetPriceMode = "sale",
  requestMessage = "",
  explicitLocationTarget?: WidgetLocationTarget
): string {
  if (!properties.length) {
    return "";
  }

  const market = formatMarketLabel(properties[0]?.market);
  const kind = formatKindSummary(properties);
  const priceRange = formatPriceRange(properties, priceMode);
  const bedroomSummary = summarizeBedrooms(properties, locale);
  const areaSummary = summarizeArea(properties, locale);
  const beachSummary = summarizeBeachDistance(properties, locale);
  const locationTarget = explicitLocationTarget ?? resolveStaticWidgetLocationTarget(requestMessage, properties[0]?.market);
  const locationSummary = locationTarget ? summarizeLocationTargetDistance(properties, locationTarget, locale) : "";
  const amenities = summarizeAmenities(properties, locale, requestMessage);
  const suitability = summarizeRequestSuitability(properties, locale, requestMessage);
  const carFreeFit = summarizeCarFreeFit(properties, locale, requestMessage);
  const investmentFit = summarizeInvestmentFit(properties, locale, requestMessage);
  const details = [priceRange, bedroomSummary, areaSummary, locationSummary, beachSummary, amenities].filter(Boolean);
  const clarificationPrompt = buildRecommendationClarificationPrompt(requestMessage, locale);

  const overviewLabels: Record<TenantWidgetLanguage, string> = {
    en: `These ${kind} options fit the ${market} search${details.length ? ` because they include ${details.join(", ")}` : ""}. Open the cards to compare exact photos, availability, and viewing details.`,
    ru:
      properties.length === 1
        ? `Этот вариант ${kind} подходит под поиск в ${market}${details.length ? `: ${details.join(", ")}` : ""}. Откройте карточку, чтобы посмотреть фото, наличие и детали просмотра.`
        : `Эти варианты ${kind} подходят под поиск в ${market}${details.length ? `: ${details.join(", ")}` : ""}. Откройте карточки, чтобы сравнить фото, наличие и детали просмотра.`,
    th: `ตัวเลือก${kind}เหล่านี้เหมาะกับการค้นหาใน ${market}${details.length ? ` เพราะมี ${details.join(", ")}` : ""} เปิดการ์ดเพื่อดูรูป ความพร้อม และรายละเอียดนัดชม`,
    zh: `这些${kind}选项符合 ${market} 搜索${details.length ? `，因为包含${details.join("、")}` : ""}。打开卡片可查看照片、可售状态和看房细节。`
  };
  const cardDescriptions = properties.map((property) => buildListingCardDescription(property, locale, priceMode, locationTarget));

  return [overviewLabels[locale] ?? overviewLabels.en, suitability, carFreeFit, investmentFit, clarificationPrompt, ...cardDescriptions]
    .filter(Boolean)
    .join("\n");
}

function summarizeCarFreeFit(
  properties: PropertySnapshot[],
  locale: TenantWidgetLanguage,
  requestMessage: string
): string | undefined {
  if (!isCarFreeRequest(requestMessage) || !properties.length) {
    return undefined;
  }

  const withFacts = properties.filter((property) => property.locationFeatures);
  const bahtBusCount = properties.filter((property) =>
    (property.locationFeatures?.nearestBahtBusRouteDistanceMeters ?? Number.POSITIVE_INFINITY) <= 700
  ).length;
  const transportCount = properties.filter((property) =>
    Math.min(
      property.locationFeatures?.nearestBahtBusRouteDistanceMeters ?? Number.POSITIVE_INFINITY,
      property.locationFeatures?.nearestPublicTransportDistanceMeters ?? Number.POSITIVE_INFINITY
    ) <= 700
  ).length;
  const supermarketCount = properties.filter((property) =>
    (property.locationFeatures?.nearestSupermarketDistanceMeters ?? Number.POSITIVE_INFINITY) <= 900
  ).length;
  const walkableCount = properties.filter((property) => (property.locationFeatures?.walkabilityScore ?? 0) >= 70).length;

  if (!withFacts.length) {
    const labels: Record<TenantWidgetLanguage, string> = {
      en: "For living without a car, I do not have saved transport or walkability facts on these shown options yet, so the agent should verify baht bus access, groceries, and day-to-day routes before you rely on them.",
      ru: "Для жизни без машины по этим вариантам пока нет сохранённых данных о транспорте и walkability, поэтому агенту стоит проверить baht bus, магазины и повседневные маршруты.",
      th: "สำหรับการอยู่โดยไม่มีรถ ยังไม่มีข้อมูลขนส่งหรือ walkability ที่บันทึกไว้สำหรับตัวเลือกเหล่านี้ ควรให้เอเจนต์ตรวจสอบบาทบัส ร้านค้า และเส้นทางประจำวัน",
      zh: "如果不打算开车，这些房源目前没有保存的交通或步行便利数据，建议让经纪人核实双条车、超市和日常路线。"
    };

    return labels[locale] ?? labels.en;
  }

  const labels: Record<TenantWidgetLanguage, string> = {
    en: `For living without a car, ${transportCount}/${properties.length} shown options have transport within about 700m, ${bahtBusCount}/${properties.length} have a baht bus signal, ${supermarketCount}/${properties.length} have groceries within about 900m, and ${walkableCount}/${properties.length} have walkability 70+/100 in saved facts.`,
    ru: `Для жизни без машины: у ${transportCount}/${properties.length} вариантов транспорт примерно в пределах 700 м, у ${bahtBusCount}/${properties.length} есть baht bus signal, у ${supermarketCount}/${properties.length} магазины примерно в пределах 900 м, у ${walkableCount}/${properties.length} walkability 70+/100 в сохранённых данных.`,
    th: `สำหรับการอยู่โดยไม่มีรถ ${transportCount}/${properties.length} รายการมีขนส่งในระยะประมาณ 700 ม., ${bahtBusCount}/${properties.length} รายการมีสัญญาณบาทบัส, ${supermarketCount}/${properties.length} รายการมีร้านของชำในระยะประมาณ 900 ม. และ ${walkableCount}/${properties.length} รายการมี walkability 70+/100`,
    zh: `如果不打算开车，${transportCount}/${properties.length} 个展示房源约 700 米内有交通，${bahtBusCount}/${properties.length} 个有双条车信号，${supermarketCount}/${properties.length} 个约 900 米内有超市，${walkableCount}/${properties.length} 个保存的步行便利评分为 70+/100。`
  };

  return labels[locale] ?? labels.en;
}

function summarizeRequestSuitability(
  properties: PropertySnapshot[],
  locale: TenantWidgetLanguage,
  requestMessage: string
): string | undefined {
  const asksForPets = isPetRequest(requestMessage);
  const asksForSpacious = isSpaciousRequest(requestMessage);
  const asksForFamily = isFamilyRequest(requestMessage);
  const asksForSchool = isSchoolRequest(requestMessage);
  const petFriendlyCount = properties.filter((property) => hasAnyAmenity(property, ["pet-friendly", "pets-allowed"])).length;
  const spaciousCount = properties.filter((property) => property.bedrooms >= 2 || property.areaSqm >= 60).length;
  const compactCount = properties.length - spaciousCount;

  if (!asksForPets && !asksForSpacious && !asksForFamily && !asksForSchool) {
    return undefined;
  }

  const spaceTradeoffLabels: Record<TenantWidgetLanguage, string> = {
    en: `Space is the main trade-off: ${compactCount}/${properties.length} shown options are compact for two dogs, so I would verify usable layout and ask the agent for larger pet-friendly studios or 1-bedrooms.`,
    ru: `Главный компромисс - площадь: ${compactCount}/${properties.length} показанных вариантов компактные для двух собак, поэтому стоит проверить удобство планировки и попросить агента найти более просторные pet-friendly студии или 1-bedroom.`,
    th: `ข้อควรระวังคือพื้นที่: ${compactCount}/${properties.length} รายการที่แสดงค่อนข้างกะทัดรัดสำหรับสุนัขสองตัว จึงควรตรวจผังห้องจริงและให้เอเจนต์หาสตูดิโอหรือ 1 ห้องนอนที่กว้างและเลี้ยงสัตว์ได้เพิ่มเติม`,
    zh: `主要取舍是面积：展示房源中 ${compactCount}/${properties.length} 个对两只狗来说偏紧凑，建议确认实际格局，并请经纪人继续找更大的宠物友好 studio 或一居室。`
  };
  const spaceTradeoff = asksForSpacious && compactCount > 0 ? ` ${spaceTradeoffLabels[locale] ?? spaceTradeoffLabels.en}` : "";

  const familyNote = buildFamilySuitabilityNote(properties, locale, asksForSchool);

  if (!asksForPets && (asksForFamily || asksForSchool) && !asksForSpacious) {
    return familyNote;
  }

  if (!asksForPets) {
    const spaciousLabels: Record<TenantWidgetLanguage, string> = {
      en: `Space is the main trade-off: ${compactCount}/${properties.length} shown options are compact, so I would verify usable layout and ask the agent for larger studios or 1-bedrooms.`,
      ru: `Главный компромисс - площадь: ${compactCount}/${properties.length} показанных вариантов компактные, поэтому стоит проверить удобство планировки и попросить агента найти более просторные студии или 1-bedroom.`,
      th: `ข้อควรระวังคือพื้นที่: ${compactCount}/${properties.length} รายการที่แสดงค่อนข้างกะทัดรัด จึงควรตรวจผังห้องจริงและให้เอเจนต์หาสตูดิโอหรือ 1 ห้องนอนที่กว้างเพิ่มเติม`,
      zh: `主要取舍是面积：展示房源中 ${compactCount}/${properties.length} 个偏紧凑，建议确认实际格局，并请经纪人继续找更大的 studio 或一居室。`
    };

    return [spaciousLabels[locale] ?? spaciousLabels.en, familyNote].filter(Boolean).join(" ");
  }

  const petLabels: Record<TenantWidgetLanguage, string> = {
    en:
      petFriendlyCount > 0
        ? `For living with pets, ${petFriendlyCount}/${properties.length} shown options have pet-friendly signals and ${spaciousCount}/${properties.length} offer 2+ bedrooms or 60+ sqm. Please confirm building pet rules, dog size limits, and deposit before booking.${spaceTradeoff}`
        : `For living with pets, pet policy still needs agent confirmation. ${spaciousCount}/${properties.length} shown options offer 2+ bedrooms or 60+ sqm, but the building rules should be checked before booking.${spaceTradeoff}`,
    ru:
      petFriendlyCount > 0
        ? `Для проживания с питомцами: ${petFriendlyCount}/${properties.length} показанных вариантов имеют pet-friendly сигнал, ${spaciousCount}/${properties.length} дают 2+ спальни или 60+ кв.м. Перед просмотром стоит подтвердить правила здания, ограничения по размеру собак и депозит.${spaceTradeoff}`
        : `Для проживания с питомцами pet policy нужно подтвердить с агентом. ${spaciousCount}/${properties.length} показанных вариантов дают 2+ спальни или 60+ кв.м, но правила здания стоит проверить до просмотра.${spaceTradeoff}`,
    th:
      petFriendlyCount > 0
        ? `สำหรับการอยู่กับสัตว์เลี้ยง ${petFriendlyCount}/${properties.length} รายการมีสัญญาณว่าเลี้ยงสัตว์ได้ และ ${spaciousCount}/${properties.length} รายการมี 2+ ห้องนอนหรือ 60+ ตร.ม. ควรยืนยันกฎสัตว์เลี้ยง ขนาดสุนัข และเงินมัดจำก่อนนัดชม${spaceTradeoff}`
        : `สำหรับการอยู่กับสัตว์เลี้ยง ต้องให้เอเจนต์ยืนยันนโยบายสัตว์เลี้ยงก่อน ${spaciousCount}/${properties.length} รายการมี 2+ ห้องนอนหรือ 60+ ตร.ม.${spaceTradeoff}`,
    zh:
      petFriendlyCount > 0
        ? `如果要和宠物一起住，${petFriendlyCount}/${properties.length} 个展示房源有宠物友好信号，${spaciousCount}/${properties.length} 个有 2+ 卧室或 60+ 平米。看房前请确认楼规、狗狗体型限制和押金。${spaceTradeoff}`
        : `如果要和宠物一起住，宠物政策仍需经纪人确认。${spaciousCount}/${properties.length} 个展示房源有 2+ 卧室或 60+ 平米，但看房前应先确认楼规。${spaceTradeoff}`
  };

  return [petLabels[locale] ?? petLabels.en, familyNote].filter(Boolean).join(" ");
}

function rankWidgetPropertiesForRequest(
  properties: PropertySnapshot[],
  requestMessage: string,
  explicitLocationTarget?: WidgetLocationTarget
): PropertySnapshot[] {
  const requestedAmenities = detectRequestedWidgetAmenities(requestMessage);
  const locationTarget = explicitLocationTarget ?? resolveStaticWidgetLocationTarget(requestMessage, properties[0]?.market);
  const preferBudgetPrice = isBudgetPriceRequest(requestMessage);
  const preferLuxuryFit = isLuxuryRequest(requestMessage);
  const preferValueForMoney = isValueForMoneyRequest(requestMessage);
  const preferLargerArea = isSpaciousRequest(requestMessage);
  const preferCloseBeach = hasSpecificLocationPreference(requestMessage) && /\b(?:beach|sea|near|close|walk)\b|пляж|море/i.test(requestMessage);
  const preferFamilyFit = isFamilyRequest(requestMessage) || isSchoolRequest(requestMessage);
  const preferCarFreeFit = isCarFreeRequest(requestMessage) || isConvenienceRequest(requestMessage);

  if (
    !requestedAmenities.length &&
    !preferBudgetPrice &&
    !preferLuxuryFit &&
    !preferValueForMoney &&
    !preferLargerArea &&
    !locationTarget &&
    !preferCloseBeach &&
    !preferFamilyFit &&
    !preferCarFreeFit
  ) {
    return properties;
  }

  return properties
    .map((property, index) => ({ index, property }))
    .sort((left, right) => {
      const amenityDelta =
        countMatchedAmenities(right.property, requestedAmenities) - countMatchedAmenities(left.property, requestedAmenities);
      if (amenityDelta !== 0) {
        return amenityDelta;
      }

      if (preferLuxuryFit) {
        const luxuryDelta = widgetLuxuryFitScore(right.property) - widgetLuxuryFitScore(left.property);
        if (luxuryDelta !== 0) {
          return luxuryDelta;
        }
      }

      if (preferValueForMoney) {
        const valueDelta = widgetValueForMoneyScore(right.property) - widgetValueForMoneyScore(left.property);
        if (valueDelta !== 0) {
          return valueDelta;
        }
      }

      if (preferFamilyFit) {
        const familyDelta = widgetFamilyFitScore(right.property) - widgetFamilyFitScore(left.property);
        if (familyDelta !== 0) {
          return familyDelta;
        }
      }

      if (preferCarFreeFit) {
        const carFreeDelta = widgetCarFreeFitScore(right.property) - widgetCarFreeFitScore(left.property);
        if (carFreeDelta !== 0) {
          return carFreeDelta;
        }
      }

      if (preferBudgetPrice) {
        const priceDelta = widgetComparablePrice(left.property) - widgetComparablePrice(right.property);
        if (priceDelta !== 0) {
          return priceDelta;
        }
      }

      if (preferLargerArea && right.property.areaSqm !== left.property.areaSqm) {
        return right.property.areaSqm - left.property.areaSqm;
      }

      if (locationTarget) {
        const locationDelta =
          distanceMeters(left.property.location, locationTarget) - distanceMeters(right.property.location, locationTarget);
        if (locationDelta !== 0) {
          return locationDelta;
        }
      }

      if (preferCloseBeach) {
        const leftDistance = left.property.beachDistanceMeters ?? Number.POSITIVE_INFINITY;
        const rightDistance = right.property.beachDistanceMeters ?? Number.POSITIVE_INFINITY;
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }
      }

      return left.index - right.index;
    })
    .map(({ property }) => property);
}

function filterByRequiredWidgetAmenities(properties: PropertySnapshot[], requestMessage: string): PropertySnapshot[] {
  const requiredAmenities = detectRequiredWidgetAmenities(requestMessage);
  const asksForFamilySized = isFamilyRequest(requestMessage) || isSchoolRequest(requestMessage);

  const filtered = requiredAmenities.length
    ? properties.filter((property) => countMatchedAmenities(property, requiredAmenities) === requiredAmenities.length)
    : properties;
  const familySized = asksForFamilySized
    ? filtered.filter((property) => property.bedrooms >= 2 || property.areaSqm >= 50)
    : [];

  return familySized.length ? familySized : filtered.length ? filtered : properties;
}

function filterByWidgetLocationTarget(properties: PropertySnapshot[], locationTarget?: WidgetLocationTarget): PropertySnapshot[] {
  if (!locationTarget?.matchRadiusMeters) {
    return properties;
  }

  const textMatchedProperties = properties.filter((property) => hasWidgetLocationTextMatch(property, locationTarget));

  if (locationTarget.kind === "area") {
    return textMatchedProperties;
  }

  const nearbyProperties = textMatchedProperties.length
    ? textMatchedProperties
    : properties.filter((property) => distanceMeters(property.location, locationTarget) <= locationTarget.matchRadiusMeters!);

  return nearbyProperties.length ? nearbyProperties : properties;
}

function hasWidgetLocationTextMatch(property: PropertySnapshot, locationTarget: WidgetLocationTarget): boolean {
  const haystack = normalizeLocationText(`${property.title} ${property.address ?? ""}`);

  return locationTarget.aliases.some((alias) => haystack.includes(normalizeLocationText(alias)));
}

function filterByWidgetListingIntent(properties: PropertySnapshot[], requestMessage: string): PropertySnapshot[] {
  const intent = detectWidgetListingIntent(requestMessage);
  if (!intent) {
    return properties;
  }

  const filtered = properties.filter((property) =>
    intent === "rent" ? ["rent", "sale_or_rent"].includes(property.listingType) : ["sale", "sale_or_rent"].includes(property.listingType)
  );

  return filtered.length ? filtered : properties;
}

function filterByWidgetKindRequirements(properties: PropertySnapshot[], requestMessage: string): PropertySnapshot[] {
  if (isHouseLikeRequest(requestMessage)) {
    const filtered = properties.filter((property) => ["villa", "townhouse"].includes(property.kind));

    return filtered.length ? filtered : [];
  }

  if (!isApartmentLikeRequest(requestMessage)) {
    return properties;
  }

  const filtered = properties.filter((property) => ["condo", "apartment"].includes(property.kind));

  return filtered.length ? filtered : properties;
}

function filterByWidgetLayoutRequirements(properties: PropertySnapshot[], requestMessage: string): PropertySnapshot[] {
  const bedroomRange = detectWidgetBedroomRange(requestMessage);
  if (bedroomRange.minBedrooms === undefined && bedroomRange.maxBedrooms === undefined) {
    return properties;
  }

  const filtered = properties.filter((property) => {
    if (bedroomRange.minBedrooms !== undefined && property.bedrooms < bedroomRange.minBedrooms) {
      return false;
    }

    if (bedroomRange.maxBedrooms !== undefined && property.bedrooms > bedroomRange.maxBedrooms) {
      return false;
    }

    return true;
  });

  return filtered.length || isStrictStudioRequest(requestMessage) ? filtered : properties;
}

function detectWidgetBedroomRange(message: string): { minBedrooms?: number; maxBedrooms?: number } {
  const normalized = message.toLowerCase();
  const studioPattern = String.raw`(?:\b(?:studio)\b|студия|студию|สตูดิโอ|开间|開間|单间|單間)`;
  const oneBedroomPattern = String.raw`(?:\b(?:1|one)\s*(?:bedroom|bedrooms|br|bed|beds)\b|однушк|однокомнат|1\s*спальн)`;
  const twoBedroomPattern = String.raw`(?:\b(?:2|two)\s*(?:bedroom|bedrooms|br|bed|beds)\b|двушк|двухкомнат|2\s*спальн)`;
  const threeBedroomPattern = String.raw`(?:\b(?:3|three)\s*(?:bedroom|bedrooms|br|bed|beds)\b|трешк|трёшк|трехкомнат|трёхкомнат|3\s*спальн)`;
  const studioOrOneBedroom = new RegExp(
    `(?:${studioPattern}.{0,40}(?:or|/|или).{0,40}${oneBedroomPattern}|${oneBedroomPattern}.{0,40}(?:or|/|или).{0,40}${studioPattern})`,
    "i"
  );

  if (studioOrOneBedroom.test(normalized)) {
    return { minBedrooms: 0, maxBedrooms: 1 };
  }

  if (new RegExp(threeBedroomPattern, "i").test(normalized)) {
    return { minBedrooms: 3, maxBedrooms: 3 };
  }

  if (new RegExp(twoBedroomPattern, "i").test(normalized)) {
    return { minBedrooms: 2, maxBedrooms: 2 };
  }

  const explicit = normalized.match(/(\d+)\s*\+?\s*(?:bedroom|bedrooms|br|спальн|спальни|спален|ห้องนอน|卧室|臥室|房间|房間|房)/);
  if (explicit?.[1]) {
    const bedrooms = Number(explicit[1]);
    const exactRequest = hasExactWidgetBedroomQualifier(normalized, explicit[0]);
    const isLowerBound = explicit[0].includes("+") || hasWidgetBedroomLowerBoundQualifier(normalized, explicit[0]);
    return exactRequest || !isLowerBound
      ? { minBedrooms: bedrooms, maxBedrooms: bedrooms }
      : { minBedrooms: bedrooms };
  }

  if (new RegExp(studioPattern, "i").test(normalized)) {
    if (isStrictStudioRequest(normalized)) {
      return { minBedrooms: 0, maxBedrooms: 0 };
    }

    const exactRequest = hasExactWidgetBedroomQualifier(normalized, "studio");
    return exactRequest ? { minBedrooms: 0, maxBedrooms: 0 } : { minBedrooms: 0 };
  }

  return {};
}

function hasExactWidgetBedroomQualifier(query: string, layoutTerm: string): boolean {
  const escapedLayoutTerm = escapeRegExp(layoutTerm.trim());

  return new RegExp(
    `(?:\\b(?:only|exactly|just)\\s+${escapedLayoutTerm}\\b|\\b${escapedLayoutTerm}\\s+(?:only|exactly|just)\\b|только\\s+${escapedLayoutTerm}|${escapedLayoutTerm}\\s+только|именно\\s+${escapedLayoutTerm}|ровно\\s+${escapedLayoutTerm})`,
    "i"
  ).test(query);
}

function hasWidgetBedroomLowerBoundQualifier(query: string, layoutTerm: string): boolean {
  const escapedLayoutTerm = escapeRegExp(layoutTerm.trim());

  return new RegExp(
    `(?:\\b${escapedLayoutTerm}\\s*(?:\\+|plus|or more|and more|or above|and above)\\b|\\b(?:at least|minimum|min|from)\\s+${escapedLayoutTerm}\\b|от\\s+${escapedLayoutTerm}|${escapedLayoutTerm}\\s*(?:\\+|или больше|и больше))`,
    "i"
  ).test(query);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isStrictStudioRequest(message: string): boolean {
  const normalized = message.toLowerCase();

  return /\b(?:studio)\b|студия|студию|สตูดิโอ|开间|開間|单间|單間/i.test(normalized) &&
    !/\b(?:studio).{0,40}(?:or|\/).{0,40}(?:1|one)\s*(?:bedroom|bedrooms|br|bed|beds)\b|(?:1|one)\s*(?:bedroom|bedrooms|br|bed|beds).{0,40}(?:or|\/).{0,40}studio\b|или/i.test(
      normalized
    );
}

function detectRequestedWidgetAmenities(message: string): string[] {
  const normalized = message.toLowerCase();
  const amenities: string[] = [];

  if (/\b(?:sea view|ocean view)\b|вид на море|วิวทะเล|海景|看海/i.test(normalized)) {
    amenities.push("sea-view");
  }

  if (/\b(?:washing machine|washer|laundry machine)\b|стиральн|стиралк|เครื่องซักผ้า|洗衣机|洗衣機/i.test(normalized)) {
    amenities.push("washing machine");
  }

  if (isPetRequest(normalized)) {
    amenities.push("pet-friendly");
  }

  if (/\b(?:pool|swimming pool)\b|бассейн|泳池|游泳池/i.test(normalized)) {
    amenities.push("pool");
  }

  if (/\b(?:gym|fitness)\b|фитнес|健身/i.test(normalized)) {
    amenities.push("gym");
  }

  return amenities;
}

function detectRequiredWidgetAmenities(message: string): string[] {
  const normalized = message.toLowerCase();
  const amenities: string[] = [];

  if (
    /\b(?:definitely|must have|required|mandatory|has to have)\b.{0,40}\b(?:washing machine|washer|laundry machine)\b|\b(?:washing machine|washer|laundry machine)\b.{0,40}\b(?:definitely|required|mandatory|must)\b/i.test(
      normalized
    )
  ) {
    amenities.push("washing machine");
  }

  return amenities;
}

function countMatchedAmenities(property: PropertySnapshot, requestedAmenities: string[]): number {
  return requestedAmenities.filter((amenity) => hasAnyAmenity(property, amenity === "pet-friendly" ? ["pet-friendly", "pets-allowed"] : [amenity])).length;
}

function widgetFamilyFitScore(property: PropertySnapshot): number {
  const familyAmenities = countMatchedAmenities(property, ["kids playground", "playground", "school", "kindergarten", "family pool", "garden"]);

  return familyAmenities * 3 + Math.min(property.bedrooms, 3) * 1.5 + Math.min(property.areaSqm / 25, 4);
}

function widgetCarFreeFitScore(property: PropertySnapshot): number {
  const features = property.locationFeatures;
  const walkabilityScore = Math.min((features?.walkabilityScore ?? 0) / 10, 10);
  const transportDistance = Math.min(
    features?.nearestBahtBusRouteDistanceMeters ?? Number.POSITIVE_INFINITY,
    features?.nearestPublicTransportDistanceMeters ?? Number.POSITIVE_INFINITY
  );
  const transportScore = widgetDistanceScore(Number.isFinite(transportDistance) ? transportDistance : undefined, 900) * 4;
  const supermarketScore = widgetDistanceScore(features?.nearestSupermarketDistanceMeters, 900) * 3;
  const mallScore = widgetDistanceScore(features?.nearestMallDistanceMeters, 2500);

  return walkabilityScore * 0.35 + transportScore + supermarketScore + mallScore;
}

function widgetDistanceScore(distanceMeters: number | undefined, comfortableDistanceMeters: number): number {
  if (distanceMeters === undefined) {
    return 0;
  }

  return Math.max(0, 1 - distanceMeters / comfortableDistanceMeters);
}

function widgetComparablePrice(property: PropertySnapshot): number {
  return property.rentalPriceMonthly?.amount ?? property.price.amount;
}

function widgetValueForMoneyScore(property: PropertySnapshot): number {
  const pricePerSqm = widgetComparablePrice(property) / Math.max(property.areaSqm, 1);
  const amenityBonus = Math.min(property.amenities.length, 8) * 0.15;

  return Math.min(1_000_000 / Math.max(pricePerSqm, 1) + amenityBonus, 10);
}

function widgetLuxuryFitScore(property: PropertySnapshot): number {
  const premiumAmenityScore = countMatchedAmenities(property, [
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
  const priceSignal = Math.min(widgetComparablePrice(property) / 5_000_000, 3);
  const areaSignal = Math.min(property.areaSqm / 80, 2);

  return premiumAmenityScore * 1.5 + priceSignal + areaSignal;
}

function buildFamilySuitabilityNote(
  properties: PropertySnapshot[],
  locale: TenantWidgetLanguage,
  asksForSchool: boolean
): string | undefined {
  if (!properties.length) {
    return undefined;
  }

  const familySignalCount = properties.filter((property) =>
    hasAnyAmenity(property, ["kids playground", "playground", "school", "kindergarten", "family pool", "garden"])
  ).length;
  const largerLayoutCount = properties.filter((property) => property.bedrooms >= 2 || property.areaSqm >= 50).length;

  const labels: Record<TenantWidgetLanguage, string> = {
    en: asksForSchool
      ? `For living with children, ${familySignalCount}/${properties.length} shown options have family-friendly signals and ${largerLayoutCount}/${properties.length} offer 2+ bedrooms or 50+ sqm. School proximity is not confirmed in the imported listing facts, so the agent should verify nearby schools and commute time.`
      : `For living with children, ${familySignalCount}/${properties.length} shown options have family-friendly signals and ${largerLayoutCount}/${properties.length} offer 2+ bedrooms or 50+ sqm.`,
    ru: asksForSchool
      ? `Для проживания с детьми: ${familySignalCount}/${properties.length} показанных вариантов имеют family-friendly сигналы, ${largerLayoutCount}/${properties.length} дают 2+ спальни или 50+ кв.м. Близость к школе не подтверждена в импортированных данных, агенту стоит проверить школы и время в пути.`
      : `Для проживания с детьми: ${familySignalCount}/${properties.length} показанных вариантов имеют family-friendly сигналы, ${largerLayoutCount}/${properties.length} дают 2+ спальни или 50+ кв.м.`,
    th: asksForSchool
      ? `สำหรับการอยู่กับเด็ก ${familySignalCount}/${properties.length} รายการมีสัญญาณเหมาะกับครอบครัว และ ${largerLayoutCount}/${properties.length} รายการมี 2+ ห้องนอนหรือ 50+ ตร.ม. ระยะถึงโรงเรียนยังไม่ได้ยืนยันในข้อมูลนำเข้า ควรให้เอเจนต์ตรวจสอบโรงเรียนและเวลาเดินทาง`
      : `สำหรับการอยู่กับเด็ก ${familySignalCount}/${properties.length} รายการมีสัญญาณเหมาะกับครอบครัว และ ${largerLayoutCount}/${properties.length} รายการมี 2+ ห้องนอนหรือ 50+ ตร.ม.`,
    zh: asksForSchool
      ? `如果和孩子一起住，${familySignalCount}/${properties.length} 个展示房源有家庭友好信号，${largerLayoutCount}/${properties.length} 个有 2+ 卧室或 50+ 平米。导入房源事实里尚未确认学校距离，建议经纪人核实附近学校和通勤时间。`
      : `如果和孩子一起住，${familySignalCount}/${properties.length} 个展示房源有家庭友好信号，${largerLayoutCount}/${properties.length} 个有 2+ 卧室或 50+ 平米。`
  };

  return labels[locale] ?? labels.en;
}

function summarizeInvestmentFit(
  properties: PropertySnapshot[],
  locale: TenantWidgetLanguage,
  requestMessage: string
): string | undefined {
  if (!isInvestmentRequest(requestMessage) || !properties.length) {
    return undefined;
  }

  const topProperty = [...properties].sort(compareInvestmentFit)[0];

  if (!topProperty) {
    return undefined;
  }

  const area = summarizeDominantArea(properties);
  const yieldValue = calculateGrossYield(topProperty);
  const yieldText = yieldValue !== undefined ? `${(yieldValue * 100).toFixed(1)}%` : undefined;
  const beachCount = properties.filter((property) => (property.beachDistanceMeters ?? Number.POSITIVE_INFINITY) <= 500).length;
  const rentEstimateCount = properties.filter((property) => property.monthlyRentEstimate || property.rentalPriceMonthly).length;

  const labels: Record<TenantWidgetLanguage, string> = {
    en: `For rental return, I would start with ${area}: it gives investor-friendly beach access, smaller 1-bedroom entry prices, and visitor demand signals. ${topProperty.title} looks strongest from the current facts${yieldText ? ` with an estimated gross yield around ${yieldText}` : rentEstimateCount ? " because it has a rent signal for yield checks" : " but rental yield needs an agent-confirmed monthly rent estimate"}. ${beachCount}/${properties.length} shown options are within 500m of the beach, which can help short-stay demand.`,
    ru: `Для арендной доходности я бы начал с района ${area}: здесь сочетаются близость к пляжу, более доступный вход для 1-bedroom и туристический спрос. По текущим данным сильнее выглядит ${topProperty.title}${yieldText ? `: ориентировочная gross yield около ${yieldText}` : rentEstimateCount ? ", потому что есть арендный сигнал для проверки доходности" : ", но доходность нужно подтвердить у агента по актуальной месячной ставке"}. ${beachCount}/${properties.length} показанных вариантов находятся в пределах 500 м от пляжа, это плюс для спроса.`,
    th: `สำหรับผลตอบแทนค่าเช่า ฉันจะเริ่มจากโซน ${area}: มีระยะถึงชายหาดที่ดี ราคาเข้าเริ่มของ 1 ห้องนอนยังคุมได้ และมีสัญญาณดีมานด์จากนักท่องเที่ยว จากข้อมูลตอนนี้ ${topProperty.title} ดูเด่นที่สุด${yieldText ? ` โดย gross yield ประมาณ ${yieldText}` : rentEstimateCount ? " เพราะมีข้อมูลค่าเช่าสำหรับเช็ก yield" : " แต่ต้องให้เอเจนต์ยืนยันค่าเช่ารายเดือนล่าสุดก่อนคำนวณ yield"} ${beachCount}/${properties.length} รายการอยู่ในระยะ 500 ม. จากชายหาด`,
    zh: `如果看租金回报，我会先从 ${area} 开始：这里有较好的海滩距离、1 房入场价较可控，也有游客需求信号。按当前资料，${topProperty.title} 最值得优先看${yieldText ? `，预估 gross yield 约 ${yieldText}` : rentEstimateCount ? "，因为有租金信号可用于收益核算" : "，但还需要经纪人确认最新月租后才能算收益"}。${beachCount}/${properties.length} 个展示房源在离海滩 500 米以内，对出租需求有帮助。`
  };

  return labels[locale] ?? labels.en;
}

function buildRecommendationClarificationPrompt(message: string, locale: TenantWidgetLanguage): string | undefined {
  const intent = detectWidgetListingIntent(message);
  const missing: Array<"budget" | "intent" | "location" | "timing"> = [];

  if (!intent) {
    missing.push("intent");
  }

  if (!hasBudgetSignal(message)) {
    missing.push("budget");
  }

  if (!hasSpecificLocationPreference(message)) {
    missing.push("location");
  }

  if (!hasTimingSignal(message)) {
    missing.push("timing");
  }

  if (missing.length < 2) {
    return undefined;
  }

  return buildMissingCriteriaPrompt(missing, intent, locale);
}

function buildMissingCriteriaPrompt(
  missing: Array<"budget" | "intent" | "location" | "timing">,
  intent: WidgetPriceMode | undefined,
  locale: TenantWidgetLanguage
): string {
  const criteria = missing
    .map((criterion) => formatMissingCriterion(criterion, intent, locale))
    .filter(Boolean);

  const joinedCriteria = joinLocalizedList(criteria, locale);
  const prefixes: Record<TenantWidgetLanguage, string> = {
    en: "To narrow this down, tell me",
    ru: "Чтобы сузить подборку, уточните",
    th: "เพื่อคัดให้แม่นขึ้น บอก",
    zh: "为了更准确筛选，请告诉我"
  };

  return `${prefixes[locale] ?? prefixes.en} ${joinedCriteria}.`;
}

function formatMissingCriterion(
  criterion: "budget" | "intent" | "location" | "timing",
  intent: WidgetPriceMode | undefined,
  locale: TenantWidgetLanguage
): string {
  const labels: Record<TenantWidgetLanguage, Record<typeof criterion, string>> = {
    en: {
      budget: intent === "rent" ? "your monthly budget" : intent === "sale" ? "your purchase budget" : "your budget",
      intent: "whether you want to rent or buy",
      location: "preferred area or beach distance",
      timing: intent === "rent" ? "move-in date and contract length" : "timing"
    },
    ru: {
      budget: intent === "rent" ? "месячный бюджет" : intent === "sale" ? "бюджет покупки" : "бюджет",
      intent: "интересует аренда или покупка",
      location: "желаемый район или расстояние до пляжа",
      timing: intent === "rent" ? "дату въезда и срок контракта" : "сроки"
    },
    th: {
      budget: intent === "rent" ? "งบเช่ารายเดือน" : intent === "sale" ? "งบซื้อ" : "งบ",
      intent: "ว่าต้องการเช่าหรือซื้อ",
      location: "โซนหรือระยะถึงชายหาด",
      timing: intent === "rent" ? "วันที่ต้องการเข้าอยู่และระยะสัญญา" : "ช่วงเวลาที่ต้องการ"
    },
    zh: {
      budget: intent === "rent" ? "月租预算" : intent === "sale" ? "购房预算" : "预算",
      intent: "是租还是买",
      location: "偏好区域或到海边距离",
      timing: intent === "rent" ? "入住时间和租期" : "时间安排"
    }
  };

  return labels[locale]?.[criterion] ?? labels.en[criterion];
}

function joinLocalizedList(items: string[], locale: TenantWidgetLanguage): string {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (locale === "zh") {
    return items.length === 2 ? `${items[0]}和${items[1]}` : `${items.slice(0, -1).join("、")}以及${items[items.length - 1]}`;
  }

  if (locale === "th") {
    return items.length === 2 ? `${items[0]}และ${items[1]}` : `${items.slice(0, -1).join("、")} และ${items[items.length - 1]}`;
  }

  if (locale === "ru") {
    return items.length === 2 ? `${items[0]} и ${items[1]}` : `${items.slice(0, -1).join(", ")} и ${items[items.length - 1]}`;
  }

  return items.length === 2 ? `${items[0]} and ${items[1]}` : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function isPetRequest(message: string) {
  return /\b(?:pet|pets|dog|dogs|cat|cats|animal|animals)\b|с\s+животн|животн|питомц|собак|кошк|สัตว์เลี้ยง|หมา|สุนัข|แมว|宠物|寵物|狗|猫|貓/i.test(
    message
  );
}

function isSpaciousRequest(message: string) {
  return /\b(?:spacious|roomy|large|larger|big|bigger|space|not tiny|not small)\b|простор|побольше|больш|не маленьк|กว้าง|พื้นที่|宽敞|寬敞|大一点|大一點/i.test(
    message
  );
}

function isFamilyRequest(message: string) {
  return /\b(?:children|child|kids|kid|family|families)\b|реб[её]н|детьми|детск|дети|детей|семья|семьи|семье|семью|семей|ครอบครัว|เด็ก|家庭|孩子/i.test(message);
}

function isSchoolRequest(message: string) {
  return /\b(?:school|kindergarten)\b|школ|садик|โรงเรียน|学校|學校/i.test(message);
}

function isApartmentLikeRequest(message: string) {
  return /\b(?:condo|apartment|flat|unit)\b|кондо|квартир|апартамент|ห้องชุด|คอนโด|公寓|单元|單元/i.test(message);
}

function isHouseLikeRequest(message: string) {
  return /\b(?:house|houses|home|homes|villa|villas|townhouse|townhome|town house|town home)\b|(?:^|[^а-яё])дома?(?:$|[^а-яё])|вилл|таунхаус|บ้าน|วิลล่า|房子|住宅|别墅|別墅|联排|聯排/i.test(message);
}

function isBudgetPriceRequest(message: string) {
  return /\b(?:budget-friendly|budget option|cheap|cheaper|affordable|low price|lowest price|economy|inexpensive)\b|бюджетн|дешев|недорог|подешевле|ประหยัด|ถูก|ราคาไม่แพง|便宜|实惠|實惠/i.test(message);
}

function isLuxuryRequest(message: string) {
  return /\b(?:luxury|premium|elite|high-end|upscale|exclusive|best quality)\b|элит|премиум|люкс|дорог|ระดับพรีเมียม|หรู|豪华|豪華|高端/i.test(message);
}

function isValueForMoneyRequest(message: string) {
  return /\b(?:best value|value for money|good deal|best deal|balanced|optimal|worth it)\b|цена.*качество|лучшее предложение|выгод|оптимальн|คุ้มค่า|性价比|性價比/i.test(message);
}

function isCarFreeRequest(message: string) {
  return /\b(?:without a car|no car|don'?t have a car|do not have a car|don'?t drive|do not drive|walkability|walkable|public transport|baht bus|songthaew)\b|без машины|не вожу|нет машины|пешком|общественный транспорт|батбас|сонгтео|บาทบัส|รถสองแถว|ไม่ขับรถ|不用车|不用車|不开车|不開車|公共交通/i.test(message);
}

function isConvenienceRequest(message: string) {
  return /\b(?:convenient|easy transport|shops|restaurants|grocery|supermarket|nearby)\b|удобн|магазин|ресторан|транспорт|ร้านอาหาร|ร้านค้า|สะดวก|便利|方便|餐厅|餐廳|商店|超市/i.test(message);
}

function hasAnyAmenity(property: PropertySnapshot, amenities: string[]) {
  const propertyAmenities = new Set(property.amenities.map((amenity) => amenity.toLowerCase()));

  return amenities.some((amenity) => propertyAmenities.has(amenity));
}

function detectWidgetListingIntent(message: string): WidgetPriceMode | undefined {
  const normalized = message.toLowerCase();
  const rentalIntent = hasRentalIntent(normalized);
  const saleIntent = hasSaleIntent(normalized);

  if (rentalIntent && !saleIntent) {
    return "rent";
  }

  if (saleIntent && !rentalIntent) {
    return "sale";
  }

  if (!rentalIntent && hasPurchaseBudgetSignal(normalized)) {
    return "sale";
  }

  return undefined;
}

function hasRentalIntent(message: string) {
  if (isInvestmentRequest(message)) {
    return false;
  }

  return /\b(?:rent|rental|lease|monthly|per month)\b|аренд|снять|เช่า|รายเดือน|ต่อเดือน|租房|租公寓|月租|每月/i.test(message);
}

function hasSaleIntent(message: string) {
  return (
    isInvestmentRequest(message) ||
    /\b(?:buy|purchase|sale|ownership|freehold)\b|купить|покуп|продаж|собствен|ซื้อ|ขาย|买|買|购买|購買/i.test(message)
  );
}

function isInvestmentRequest(message: string) {
  return /\b(?:invest|investment|yield|roi|rental return|rental income|rent out|buy-to-let)\b|инвест|доходн|сдач|арендн(?:ая|ой)?\s+доход|ลงทุน|ผลตอบแทน|ปล่อยเช่า|投资|投資|收益|回报|回報|出租收益/i.test(
    message
  );
}

function compareInvestmentFit(left: PropertySnapshot, right: PropertySnapshot) {
  return investmentFitScore(right) - investmentFitScore(left);
}

function investmentFitScore(property: PropertySnapshot) {
  const grossYield = calculateGrossYield(property) ?? 0;
  const beachScore =
    property.beachDistanceMeters !== undefined ? Math.max(0, 18 - property.beachDistanceMeters / 100) : 0;
  const rentSignalScore = property.monthlyRentEstimate || property.rentalPriceMonthly ? 18 : 0;
  const investorAmenityScore = countMatchingAmenities(property, [
    "24h security",
    "security",
    "gym",
    "pool",
    "communal pool",
    "balcony",
    "washing machine",
    "fiber-internet",
    "high-speed internet",
    "coworking space",
    "parking"
  ]);
  const compactEntryScore = property.bedrooms <= 1 && property.areaSqm <= 45 ? 8 : 0;

  return grossYield * 300 + beachScore + rentSignalScore + investorAmenityScore + compactEntryScore;
}

function calculateGrossYield(property: PropertySnapshot): number | undefined {
  const monthlyRent = property.monthlyRentEstimate?.amount ?? property.rentalPriceMonthly?.amount;

  if (!monthlyRent || property.price.amount <= 0) {
    return undefined;
  }

  return (monthlyRent * 12) / property.price.amount;
}

function countMatchingAmenities(property: PropertySnapshot, amenities: string[]) {
  return amenities.filter((amenity) => hasAnyAmenity(property, [amenity])).length;
}

function summarizeDominantArea(properties: PropertySnapshot[]) {
  const buckets = new Map<string, number>();

  for (const property of properties) {
    const area = extractAreaLabel(property);
    buckets.set(area, (buckets.get(area) ?? 0) + 1);
  }

  return [...buckets.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "Pattaya";
}

function extractAreaLabel(property: PropertySnapshot) {
  const source = [property.address, property.project?.name, property.title].filter(Boolean).join(" ");
  const areas = [
    "Pratumnak",
    "Jomtien",
    "Wongamat",
    "Naklua",
    "Central Pattaya",
    "East Pattaya",
    "Na Jomtien"
  ];

  return areas.find((area) => new RegExp(area.replace(" ", "\\s+"), "i").test(source)) ?? formatMarketLabel(property.market);
}

function hasPurchaseBudgetSignal(message: string) {
  return /\b(?:under|below|max|maximum|budget)?\s*\d+(?:[.,]\d+)?\s*(?:m|million)\b|до\s*\d+(?:[.,]\d+)?\s*млн/i.test(message);
}

function hasBudgetSignal(message: string) {
  return /(?:\d+(?:[.,]\d+)?\s*(?:m|million|k|thousand|млн|тыс|ล้าน|万|萬)|\d[\d\s,.]*\s*(?:thb|baht|บาท|泰铢|泰銖|бат))/i.test(message);
}

function hasSpecificLocationPreference(message: string) {
  return /\b(?:jomtien|wongamat|pratumnak|naklua|central|east pattaya|na jomtien|beach|sea|walk|quiet|near)\b|джомтьен|вонгамат|пратамнак|наклуа|центр|пляж|море|тих|ใกล้|ชายหาด|ทะเล|海|海边|海邊|海滩|海灘|安静/i.test(message);
}

function hasTimingSignal(message: string) {
  return /\b(?:today|tomorrow|weekend|next week|month|year|move-in|move in|contract|lease term|soon|later|future|january|february|march|april|may|june|july|august|september|october|november|december)\b|сегодня|завтра|выходн|месяц|год|заезд|въезд|въезж|через\s+(?:\d+|один|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать)\s+дн|контракт|скоро|позже|อนาคต|เดือน|ปี|入住|合同|月份|明天|今天/i.test(message);
}

function resolveWidgetPriceMode(message = ""): WidgetPriceMode {
  const normalized = message.toLowerCase();
  const rentalIntent = hasRentalIntent(normalized);
  const saleIntent = hasSaleIntent(normalized);

  return rentalIntent && !saleIntent ? "rent" : "sale";
}

function formatMarketLabel(market?: PropertySnapshot["market"]): string {
  const labels: Partial<Record<PropertySnapshot["market"], string>> = {
    bangkok: "Bangkok",
    "hua-hin": "Hua Hin",
    "koh-samui": "Koh Samui",
    pattaya: "Pattaya",
    phuket: "Phuket"
  };

  return market ? labels[market] ?? market : "selected market";
}

function formatKindLabel(kind?: PropertySnapshot["kind"]): string {
  const labels: Partial<Record<PropertySnapshot["kind"], string>> = {
    commercial: "commercial property",
    condo: "condo",
    land: "land",
    townhouse: "townhouse",
    villa: "villa"
  };

  return kind ? labels[kind] ?? kind : "property";
}

function formatKindSummary(properties: PropertySnapshot[]): string {
  const kinds = Array.from(new Set(properties.map((property) => property.kind)));

  return kinds.length === 1 ? formatKindLabel(kinds[0]) : "property";
}

function formatPriceRange(properties: PropertySnapshot[], priceMode: WidgetPriceMode = "sale"): string {
  const rentalPrices = properties.flatMap((property) =>
    property.rentalPriceMonthly && property.rentalPriceMonthly.amount >= 1_000 ? [property.rentalPriceMonthly] : []
  );
  const shouldShowRent =
    priceMode === "rent" &&
    rentalPrices.length > 0 &&
    properties.every((property) => property.listingType === "rent" || property.listingType === "sale_or_rent" || property.rentalPriceMonthly);
  const prices = shouldShowRent
    ? rentalPrices
    : properties.map((property) => property.price).filter((price): price is PropertySnapshot["price"] => Boolean(price) && price.amount >= 100_000);

  if (!prices.length) {
    return "";
  }

  const currency = prices[0]?.currency ?? "THB";
  const min = Math.min(...prices.map((price) => price.amount));
  const max = Math.max(...prices.map((price) => price.amount));

  return min === max
    ? `${formatMoneyAmount(min)} ${currency}${shouldShowRent ? "/mo" : ""}`
    : `${formatMoneyAmount(min)}-${formatMoneyAmount(max)} ${currency}${shouldShowRent ? "/mo" : ""}`;
}

function formatMoneyAmount(value: number): string {
  if (value >= 1_000_000) {
    return `${Number((value / 1_000_000).toFixed(1)).toLocaleString("en-US")}M`;
  }

  if (value >= 1_000) {
    return `${Math.round(value / 1_000).toLocaleString("en-US")}k`;
  }

  return value.toLocaleString("en-US");
}

function formatRussianBedrooms(value: number): string {
  const normalized = Math.abs(value);
  const lastDigit = normalized % 10;
  const lastTwoDigits = normalized % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return `${value} спальня`;
  }

  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${value} спальни`;
  }

  return `${value} спален`;
}

function formatAmenityLabel(amenity: string, locale: TenantWidgetLanguage): string {
  if (locale !== "ru") {
    return amenity;
  }

  const labels: Record<string, string> = {
    "24h security": "охрана 24/7",
    balcony: "балкон",
    "communal pool": "общий бассейн",
    "covered parking": "крытая парковка",
    coworking: "коворкинг",
    "coworking space": "коворкинг",
    "coworking-lounge": "коворкинг-зона",
    "European kitchen": "европейская кухня",
    "fast-internet": "быстрый интернет",
    "fiber-internet": "оптоволоконный интернет",
    garden: "сад",
    gym: "спортзал",
    "high-speed internet": "быстрый интернет",
    "key card access": "доступ по карте",
    "kids playground": "детская площадка",
    "pet-friendly": "можно с питомцами",
    pool: "бассейн",
    "sea-view": "вид на море",
    "shuttle service": "шаттл",
    "washing machine": "стиральная машина",
    workspace: "рабочее место"
  };

  return labels[amenity] ?? amenity.replaceAll("-", " ");
}

function summarizeBedrooms(properties: PropertySnapshot[], locale: TenantWidgetLanguage): string {
  const bedrooms = Array.from(new Set(properties.map((property) => property.bedrooms ?? 0))).sort((left, right) => left - right);

  if (!bedrooms.length) {
    return "";
  }

  const minBedrooms = bedrooms[0] ?? 0;
  const maxBedrooms = bedrooms[bedrooms.length - 1] ?? minBedrooms;
  const value =
    bedrooms.length === 1 ? (minBedrooms === 0 ? "studio" : String(minBedrooms)) : minBedrooms === 0 ? `studio-${maxBedrooms}` : `${minBedrooms}-${maxBedrooms}`;
  const labels: Record<TenantWidgetLanguage, string> = {
    en: value === "studio" ? "studio layouts" : `${value} bedroom${value === "1" ? "" : "s"}`,
    ru:
      bedrooms.length === 1
        ? minBedrooms === 0
          ? "студия"
          : formatRussianBedrooms(minBedrooms)
        : minBedrooms === 0
          ? maxBedrooms === 1
            ? "студия и 1 спальня"
            : `студии-${formatRussianBedrooms(maxBedrooms)}`
          : `${minBedrooms}-${formatRussianBedrooms(maxBedrooms)}`,
    th: `${value} ห้องนอน`,
    zh: `${value} 间卧室`
  };

  return labels[locale] ?? labels.en;
}

function summarizeArea(properties: PropertySnapshot[], locale: TenantWidgetLanguage): string {
  const areas = properties.map((property) => property.areaSqm ?? 0).filter((value) => value >= 10);

  if (!areas.length) {
    return "";
  }

  const min = Math.min(...areas);
  const max = Math.max(...areas);
  const value = min === max ? `${min}` : `${min}-${max}`;
  const labels: Record<TenantWidgetLanguage, string> = {
    en: `${value} sqm layouts`,
    ru: `площади ${value} кв.м`,
    th: `พื้นที่ ${value} ตร.ม.`,
    zh: `${value} 平米户型`
  };

  return labels[locale] ?? labels.en;
}

function summarizeBeachDistance(properties: PropertySnapshot[], locale: TenantWidgetLanguage): string {
  const distances = properties
    .map((property) => property.beachDistanceMeters)
    .filter((value): value is number => typeof value === "number" && value >= 0);

  if (!distances.length) {
    return "";
  }

  const closest = Math.min(...distances);
  const labels: Record<TenantWidgetLanguage, string> = {
    en: `closest option about ${closest}m from the beach`,
    ru: `ближайший вариант примерно ${closest} м от пляжа`,
    th: `ตัวเลือกที่ใกล้ที่สุดประมาณ ${closest} ม. จากชายหาด`,
    zh: `最近选项距离海滩约 ${closest} 米`
  };

  return labels[locale] ?? labels.en;
}

function summarizeLocationTargetDistance(
  properties: PropertySnapshot[],
  target: WidgetLocationTarget,
  locale: TenantWidgetLanguage
): string {
  if (target.kind === "area") {
    const labels: Record<TenantWidgetLanguage, string> = {
      en: `area: ${target.label}`,
      ru: `район: ${target.label}`,
      th: `ทำเล: ${target.label}`,
      zh: `区域：${target.label}`
    };

    return labels[locale] ?? labels.en;
  }

  const distances = properties.map((property) => distanceMeters(property.location, target));

  if (!distances.length) {
    return "";
  }

  const closest = Math.min(...distances);
  const labels: Record<TenantWidgetLanguage, string> = {
    en: `closest option about ${formatDistance(closest)} from ${target.label}`,
    ru: `ближайший вариант примерно ${formatDistance(closest)} от ${target.label}`,
    th: `ตัวเลือกที่ใกล้ที่สุดประมาณ ${formatDistance(closest)} จาก ${target.label}`,
    zh: `最近选项距离 ${target.label} 约 ${formatDistance(closest)}`
  };

  return labels[locale] ?? labels.en;
}

function summarizeSingleLocationTargetDistance(
  property: PropertySnapshot,
  locale: TenantWidgetLanguage,
  target?: WidgetLocationTarget
): string {
  if (!target) {
    return "";
  }

  if (target.kind === "area") {
    if (!hasWidgetLocationTextMatch(property, target)) {
      return "";
    }

    const labels: Record<TenantWidgetLanguage, string> = {
      en: `in or near ${target.label}`,
      ru: `в районе ${target.label}`,
      th: `ในย่าน ${target.label}`,
      zh: `位于 ${target.label} 区域`
    };

    return labels[locale] ?? labels.en;
  }

  const distance = formatDistance(distanceMeters(property.location, target));
  const labels: Record<TenantWidgetLanguage, string> = {
    en: `about ${distance} from ${target.label}`,
    ru: `примерно ${distance} от ${target.label}`,
    th: `ประมาณ ${distance} จาก ${target.label}`,
    zh: `距离 ${target.label} 约 ${distance}`
  };

  return labels[locale] ?? labels.en;
}

function summarizeAmenities(properties: PropertySnapshot[], locale: TenantWidgetLanguage, requestMessage = ""): string {
  const allAmenities = Array.from(new Set(properties.flatMap((property) => property.amenities ?? []).filter(Boolean)));
  const requestedAmenities = detectRequestedWidgetAmenities(requestMessage).filter((amenity) =>
    properties.some((property) => hasAnyAmenity(property, amenity === "pet-friendly" ? ["pet-friendly", "pets-allowed"] : [amenity]))
  );
  const amenities = [
    ...requestedAmenities,
    ...allAmenities.filter((amenity) => !requestedAmenities.includes(amenity))
  ].slice(0, 3);
  const localizedAmenities = amenities.map((amenity) => formatAmenityLabel(amenity, locale));
  const labels: Record<TenantWidgetLanguage, string> = {
    en: `amenities like ${localizedAmenities.join(", ")}`,
    ru: `удобства: ${localizedAmenities.join(", ")}`,
    th: `สิ่งอำนวยความสะดวก เช่น ${localizedAmenities.join(", ")}`,
    zh: `配套包括${localizedAmenities.join("、")}`
  };

  return amenities.length ? labels[locale] ?? labels.en : "";
}

function isPublicWidgetRecommendableProperty(property: PropertySnapshot): boolean {
  return (
    property.status === "available" &&
    (property.price.amount >= 100_000 || (property.rentalPriceMonthly?.amount ?? 0) >= 1_000) &&
    property.areaSqm >= 10 &&
    !/(^|\s)(smoke|starter import)\b/i.test(property.title)
  );
}

function buildListingCardDescription(
  property: PropertySnapshot,
  locale: TenantWidgetLanguage,
  priceMode: WidgetPriceMode = "sale",
  locationTarget?: WidgetLocationTarget
): string {
  const facts = [
    formatPriceRange([property], priceMode),
    summarizeBedrooms([property], locale),
    summarizeArea([property], locale),
    summarizeSingleLocationTargetDistance(property, locale, locationTarget),
    summarizeBeachDistance([property], locale),
    summarizeAmenities([property], locale)
  ].filter(Boolean);
  const detail = facts.length ? facts.join(", ") : formatMarketLabel(property.market);

  return `${property.title}: ${detail}.`;
}

function resolveStaticWidgetLocationTarget(message: string, market?: PropertySnapshot["market"]): WidgetLocationTarget | undefined {
  const normalized = normalizeLocationText(message);
  const targets = market ? WIDGET_LOCATION_TARGETS[market] ?? [] : Object.values(WIDGET_LOCATION_TARGETS).flat();
  const matches = targets
    .flatMap((target) =>
      target.aliases
        .map((alias) => ({ index: normalized.lastIndexOf(normalizeLocationText(alias)), target }))
        .filter((match) => match.index >= 0)
    )
    .sort((left, right) => right.index - left.index);

  return matches[0]?.target;
}

function distanceMeters(from: PropertySnapshot["location"], to: Pick<WidgetLocationTarget, "latitude" | "longitude">): number {
  const earthRadiusMeters = 6_371_000;
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters >= 10_000) {
    return `${Number((distanceMeters / 1000).toFixed(1))}km`;
  }

  if (distanceMeters >= 1000) {
    return `${Number((distanceMeters / 1000).toFixed(2))}km`;
  }

  return `${distanceMeters}m`;
}

function normalizeLocationText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveWidgetPersona(tenant: TenantSnapshot, locale: TenantWidgetLanguage): AiConciergePersona {
  return {
    gender: tenant.widget.personaGenders[locale] ?? "neutral",
    leadQualificationFields: tenant.widget.leadQualificationFields,
    name: tenant.widget.aiNames[locale] ?? tenant.widget.aiName,
    tone: tenant.widget.tone,
    welcomeMessage: tenant.widget.welcomeMessages[locale] ?? tenant.widget.welcomeMessage
  };
}

function assertPublicWidgetAskPayloadBounds(payload: PublicWidgetAskDto): void {
  if (payload.message.length > 2_000) {
    throw new BadRequestException("Widget message must be 2,000 characters or fewer");
  }

  assertPublicWidgetConversationBounds(payload.conversation);
}

function assertPublicWidgetConversationBounds(conversation: AiChatTurn[] | undefined): void {
  if ((conversation ?? []).length > 12) {
    throw new BadRequestException("Widget conversation history must include 12 turns or fewer");
  }

  for (const turn of conversation ?? []) {
    if (turn.text.length > 2_000) {
      throw new BadRequestException("Widget conversation turn text must be 2,000 characters or fewer");
    }

    if ((turn.recommendedListings ?? []).length > 3) {
      throw new BadRequestException("Widget conversation turns can include at most 3 recommended listings");
    }
  }
}

function resolveClientIp(request: PublicWidgetRequest): string {
  const forwarded = readFirstHeader(request, "x-forwarded-for")?.split(",")[0]?.trim();
  const cloudflare = readFirstHeader(request, "cf-connecting-ip")?.trim();
  const realIp = readFirstHeader(request, "x-real-ip")?.trim();

  return forwarded || cloudflare || realIp || request.ip || request.socket?.remoteAddress || "unknown";
}

function readFirstHeader(request: PublicWidgetRequest, header: string): string | undefined {
  const value = request.headers[header];

  return Array.isArray(value) ? value[0] : value;
}

function normalizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function resolveLeadPropertyId(payload: PublicWidgetLeadDto): string | undefined {
  const plan = planAiChatRetrieval({
    conversation: payload.conversation,
    locale: payload.locale,
    message: payload.message ?? ""
  });

  if (plan.mode === "property-detail" && plan.propertyId) {
    return plan.propertyId;
  }

  return payload.recommendedListings?.find((listing: AiChatReferencedListing) => listing.propertyId.trim())?.propertyId.trim();
}

function buildQualifiedLeadMessage(payload: PublicWidgetLeadDto, propertyId?: string): string | undefined {
  const lines = ["Widget handoff request."];
  const visitorNote = normalizeOptional(payload.message);
  const recommendedListings = resolveLeadRecommendedListings(payload, propertyId);
  const qualification = buildLeadQualificationSection(payload);
  const conversation = (payload.conversation ?? [])
    .filter((turn: AiChatTurn) => turn.text.trim())
    .slice(-8);

  if (visitorNote) {
    lines.push(`Visitor note: ${visitorNote}`);
  }

  if (qualification) {
    lines.push(qualification);
  }

  if (recommendedListings.length) {
    lines.push(
      [
        "Recommended listings:",
        ...recommendedListings.map(
          (listing: AiChatReferencedListing, index: number) => `${index + 1}. ${listing.title} (${listing.propertyId})`
        )
      ].join("\n")
    );
  }

  if (conversation.length) {
    lines.push(
      [
        "Recent widget conversation:",
        ...conversation.map((turn: AiChatTurn) => {
          const listings = (turn.recommendedListings ?? [])
            .slice(0, 3)
            .map(
              (listing: AiChatReferencedListing, index: number) =>
                `${index + 1}. ${listing.title} (${listing.propertyId})`
            );
          const suffix = listings.length ? `\nShown listings:\n${listings.join("\n")}` : "";

          return `${turn.role}: ${turn.text.trim()}${suffix}`;
        })
      ].join("\n")
    );
  }

  return lines.join("\n\n").slice(0, 3000);
}

function resolveLeadRecommendedListings(payload: PublicWidgetLeadDto, propertyId?: string): AiChatReferencedListing[] {
  const seen = new Set<string>();
  const allListings = [
    ...(payload.recommendedListings ?? []),
    ...(payload.conversation ?? []).flatMap((turn: AiChatTurn) => turn.recommendedListings ?? [])
  ].filter((listing: AiChatReferencedListing) => listing.propertyId.trim() && listing.title.trim());
  const selectedListing = propertyId ? allListings.find((listing) => listing.propertyId === propertyId) : undefined;

  return [selectedListing, ...allListings]
    .filter((listing): listing is AiChatReferencedListing => Boolean(listing))
    .filter((listing) => {
      if (seen.has(listing.propertyId)) {
        return false;
      }

      seen.add(listing.propertyId);

      return true;
    })
    .slice(0, 3);
}

function assessWidgetLeadStatus(
  payload: PublicWidgetLeadDto,
  context: { contactEmail?: string; contactPhone?: string; propertyId?: string }
): LeadStatus {
  if (!context.contactEmail && !context.contactPhone) {
    return "new";
  }

  const source = buildLeadQualificationSource(payload);
  const hasSelectedListing = Boolean(context.propertyId);
  const hasIntent = Boolean(parseDealIntent(source));
  const hasBudget = Boolean(parseBudget(source));
  const hasPurpose = Boolean(parsePurpose(source));
  const hasTimeline = Boolean(
    parsePurchaseTiming(source) ||
      parseMoveInDate(source) ||
      parseContractLength(source) ||
      parseViewingTime(source) ||
      parsePreferredContactTime(source)
  );
  const signalCount = [hasSelectedListing, hasIntent, hasBudget, hasPurpose, hasTimeline].filter(Boolean).length;

  return signalCount >= 3 ? "qualified" : "new";
}

function buildLeadQualificationSection(payload: PublicWidgetLeadDto): string | undefined {
  const source = buildLeadQualificationSource(payload);
  const dealIntent = parseDealIntent(source);
  const budget = parseBudget(source);
  const purpose = parsePurpose(source);
  const ownershipStructure = parseOwnershipStructure(source);
  const purchaseTiming = parsePurchaseTiming(source);
  const moveInDate = parseMoveInDate(source);
  const contractLength = parseContractLength(source);
  const viewingTime = parseViewingTime(source);
  const preferredContactTime = parsePreferredContactTime(source);
  const contactPreference = parseContactPreference(source);
  const details = [
    dealIntent ? `Intent: ${dealIntent}` : undefined,
    budget ? `Budget: ${budget}` : undefined,
    purpose ? `Purpose: ${purpose}` : undefined,
    ownershipStructure ? `Ownership/quota: ${ownershipStructure}` : undefined,
    purchaseTiming ? `Purchase timing: ${purchaseTiming}` : undefined,
    moveInDate ? `Move-in: ${moveInDate}` : undefined,
    contractLength ? `Contract length: ${contractLength}` : undefined,
    viewingTime ? `Viewing time: ${viewingTime}` : undefined,
    preferredContactTime ? `Preferred contact time: ${preferredContactTime}` : undefined,
    contactPreference ? `Contact channel: ${contactPreference}` : undefined
  ].filter(Boolean);

  return details.length ? ["Lead qualification:", ...details].join("\n") : undefined;
}

function buildLeadQualificationSource(payload: PublicWidgetLeadDto): string {
  return [
    payload.message,
    ...(payload.conversation ?? []).filter((turn: AiChatTurn) => turn.role === "user").map((turn: AiChatTurn) => turn.text)
  ]
    .filter(Boolean)
    .join("\n");
}

function parseDealIntent(text: string): string | undefined {
  const normalized = text.toLowerCase();

  if (/\b(?:rent|rental|lease|monthly|per month)\b|аренд|снять|เช่า|รายเดือน|ต่อเดือน|租|月租|每月/i.test(normalized)) {
    return "Rent";
  }

  if (/\b(?:buy|purchase|sale|ownership|freehold|quota)\b|купить|покуп|продаж|собствен|ซื้อ|ขาย|买|買|购买|購買/i.test(normalized)) {
    return "Buy";
  }

  return undefined;
}

function parseBudget(text: string): string | undefined {
  const match = [
    /(?:under|below|max|up to|budget|до|менее|не больше|ไม่เกิน|ต่ำกว่า|งบ|预算|預算|预算是|預算是|不超过|不超過|低于|低於)\s*[0-9]+(?:[.,][0-9]+)?\s*(?:m|million|млн|ล้าน|百万|百萬|万|萬|k|thousand|тысяч|тыс)?\s*(?:thb|baht|бат|บาท|泰铢|泰銖)?(?:\s*(?:per month|monthly|month|месяц|мес|ต่อเดือน|รายเดือน|每月|月租))?/i,
    /[0-9]+(?:[.,][0-9]+)?\s*(?:m|million|млн|ล้าน|百万|百萬|万|萬|k|thousand|тысяч|тыс)\s*(?:thb|baht|бат|บาท|泰铢|泰銖)?(?:\s*(?:per month|monthly|month|месяц|мес|ต่อเดือน|รายเดือน|每月|月租))?/i,
    /[0-9][0-9\s,.]*\s*(?:thb|baht|бат|บาท|泰铢|泰銖)(?:\s*(?:per month|monthly|month|месяц|мес|ต่อเดือน|รายเดือน|每月|月租))?/i
  ].map((pattern) => text.match(pattern)).find(Boolean);

  return match?.[0] ? normalizeQualificationValue(match[0]) : undefined;
}

function parseOwnershipStructure(text: string): string | undefined {
  const normalized = text.toLowerCase();

  if (/(foreign quota|foreigner|foreign name|иностранн|фаранг|ต่างชาติ|ชาวต่างชาติ|外国|外國|外籍)/i.test(normalized)) {
    return "Foreign quota";
  }

  if (/(thai quota|thai name|thai person|тайск|таец|тайца|คนไทย|ชื่อไทย|泰国人|泰國人|泰籍)/i.test(normalized)) {
    return "Thai name/quota";
  }

  if (/(company|company name|thai company|компан|บริษัท|公司)/i.test(normalized)) {
    return "Company";
  }

  return undefined;
}

function parsePurchaseTiming(text: string): string | undefined {
  const normalized = text.toLowerCase();

  if (!/(buy|purchase|ownership|freehold|quota|купить|покуп|собствен|ซื้อ|购买|購買|买|買)/i.test(normalized)) {
    return undefined;
  }

  const match = normalized.match(
    /(?:asap|soon|right away|this month|next month|this year|next year|in\s+[0-9]+\s+(?:weeks|months|years)|within\s+[0-9]+\s+(?:weeks|months|years)|в ближайшее время|срочно|в этом месяце|в следующем месяце|в этом году|в следующем году|через\s+[0-9]+\s+(?:недел|месяц|год)|เร็วๆนี้|เดือนนี้|เดือนหน้า|ปีนี้|ปีหน้า|今年|明年|下个月|下個月|这个月|這個月)/i
  );

  return match?.[0] ? normalizeQualificationValue(match[0]) : undefined;
}

function parseMoveInDate(text: string): string | undefined {
  const normalized = text.toLowerCase();

  if (!/(rent|rental|lease|move in|move-in|аренд|снять|заехать|въезд|въезж|เช่า|ย้ายเข้า|入住|租)/i.test(normalized)) {
    return undefined;
  }

  const match = normalized.match(
    /(?:move[-\s]?in|available from|start from|from|заезд|въезд|въезжаю|въехать|заехать|с\s+|ย้ายเข้า|入住)\s+(today|tomorrow|next week|next month|this weekend|[0-9]{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)|[0-9]{1,2}[./-][0-9]{1,2}(?:[./-][0-9]{2,4})?|сегодня|завтра|на следующей неделе|в следующем месяце|в конце\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)|конец\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)|через\s+(?:\d+|один|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать)\s+дн\w*|เดือนหน้า|พรุ่งนี้|明天|下周|下週|下个月|下個月)/i
  );

  return match?.[1] ? normalizeQualificationValue(match[1]) : undefined;
}

function parseContractLength(text: string): string | undefined {
  const match = text.match(
    /(?:for|contract|lease|term|на|контракт|срок|สัญญา|租期)\s*([0-9]+(?:[.,][0-9]+)?\s*(?:months|month|years|year|mo|мес|месяцев|месяца|месяц|года|год|лет|เดือน|ปี|个月|個月|年)|полгода)|([0-9]+(?:[.,][0-9]+)?\s*(?:months|month|years|year|mo|мес|месяцев|месяца|месяц|года|год|лет|เดือน|ปี|个月|個月|年)\s*(?:contract|lease|term|контракт|договор|สัญญา|租期)?)|(полгода)/i
  );

  return match?.[1] || match?.[2] || match?.[3] ? normalizeQualificationValue(match[1] ?? match[2] ?? match[3]!) : undefined;
}

function parsePurpose(text: string): string | undefined {
  const normalized = text.toLowerCase();
  const candidates = [
    { label: "Investment", pattern: /(investment|invest|rental yield|yield|инвест|доходн|ลงทุน|投资|投資|收益)/gi },
    { label: "Relocation", pattern: /(relocation|relocat|move to|переезд|релокац|ย้าย|搬家|移居)/gi },
    { label: "Family living", pattern: /(family|school|семья|семьи|семье|семью|семей|школ|ครอบครัว|โรงเรียน|家庭|学校|學校)/gi },
    { label: "Personal use", pattern: /(personal use|for myself|live there|living|для себя|жить|อยู่อาศัย|自住|自己住)/gi }
  ];
  const latest = candidates
    .flatMap(({ label, pattern }) => [...normalized.matchAll(pattern)].map((match) => ({ index: match.index ?? -1, label })))
    .sort((left, right) => right.index - left.index)[0];

  return latest?.label;
}

function parseContactPreference(text: string): string | undefined {
  const normalized = text.toLowerCase();

  if (/(whatsapp|ватсап|วอตส์แอป)/i.test(normalized)) {
    return "WhatsApp";
  }

  if (/(telegram|телеграм|тг)/i.test(normalized)) {
    return "Telegram";
  }

  if (/(line|ไลน์)/i.test(normalized)) {
    return "LINE";
  }

  if (/(email|e-mail|почт|อีเมล|邮箱|郵箱)/i.test(normalized)) {
    return "Email";
  }

  if (/(phone|call|телефон|номер|звон|โทร|电话|電話)/i.test(normalized)) {
    return "Phone";
  }

  return undefined;
}

const timingPattern =
  /next week|next month|this weekend|weekend|day after tomorrow|tomorrow(?:\s+(?:morning|afternoon|evening|night))?|today(?:\s+(?:morning|afternoon|evening|night))?|in\s+[0-9]+\s+days?|within\s+[0-9]+\s+(?:days|weeks|months)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+[0-9]{1,2}(?::[0-9]{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?|[0-9]{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+at\s+[0-9]{1,2}(?::[0-9]{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?|следующ(?:ей|ий|ем)\s+\S+|через\s+[0-9]+\s+дн\w*|на\s+выходных|в\s+выходные|послезавтра|завтра(?:\s+(?:утром|днем|днём|вечером))?|сегодня(?:\s+(?:утром|днем|днём|вечером))?|(?:понедельник|вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресенье)(?:\s+в\s+(?:[0-9]{1,2}(?::[0-9]{2})?|час(?:\s+дня)?|полдень))?|วัน(?:นี้|พรุ่งนี้)|พรุ่งนี้|สัปดาห์หน้า|เดือนหน้า|明天(?:上午|下午|晚上)?|今天(?:上午|下午|晚上)?|后天|後天|周末|週末|下周|下週|下个月|下個月/gi;

const viewingTimingContextPattern =
  /\b(?:viewing|view|see it|see the|tour|visit|showing|appointment)\b|просмотр|посмотр|показ|посетить|встреч|ดูห้อง|นัดชม|ดูคอนโด|看房|看一下|参观|參觀|预约看|預約看/i;

const contactTimingContextPattern =
  /\b(?:contact|call|message|text|whatsapp|line|telegram|email|reach me|follow up)\b|связ|позвон|звон|напиш|сообщ|ватсап|телеграм|почт|лайн|โทร|ติดต่อ|ไลน์|อีเมล|微信|联系|聯繫|打电话|打電話|发消息|發消息/i;

function parseViewingTime(text: string): string | undefined {
  return parseContextualTiming(text, viewingTimingContextPattern);
}

function parsePreferredContactTime(text: string): string | undefined {
  return parseContextualTiming(text, contactTimingContextPattern);
}

function parseContextualTiming(text: string, contextPattern: RegExp): string | undefined {
  timingPattern.lastIndex = 0;
  const matches = [
    ...text.matchAll(
      timingPattern
    )
  ].filter((match) => contextPattern.test(getSentenceAround(text, match.index ?? 0, match[0].length)));
  const match = matches.at(-1);

  return match?.[0] ? normalizeQualificationValue(match[0]) : undefined;
}

function getSentenceAround(text: string, index: number, length: number): string {
  const before = text.slice(0, index);
  const after = text.slice(index + length);
  const start = Math.max(before.lastIndexOf("."), before.lastIndexOf("?"), before.lastIndexOf("!"), before.lastIndexOf("\n"), before.lastIndexOf("。"), before.lastIndexOf("？"), before.lastIndexOf("！")) + 1;
  const endCandidates = [after.indexOf("."), after.indexOf("?"), after.indexOf("!"), after.indexOf("\n"), after.indexOf("。"), after.indexOf("？"), after.indexOf("！")]
    .filter((candidate) => candidate >= 0)
    .map((candidate) => index + length + candidate);
  const end = endCandidates.length ? Math.min(...endCandidates) : text.length;

  return text.slice(start, end);
}

function normalizeQualificationValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function resolveRequestOrigin(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).origin.toLowerCase();
  } catch (_error) {
    return undefined;
  }
}

function buildListingUrl(origin: string, template: string, propertyId: string): string {
  const resolvedPath = template.replace(/:propertyId/g, encodeURIComponent(propertyId));

  return new URL(resolvedPath, origin).toString();
}

function normalizeListingUrlTemplate(template: string): string {
  const trimmed = template.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || !trimmed.includes(":propertyId")) {
    return "/listings/:propertyId";
  }

  return trimmed.slice(0, 160);
}
