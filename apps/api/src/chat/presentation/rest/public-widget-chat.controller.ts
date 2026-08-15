import { BadRequestException, Body, Controller, Headers, Inject, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type {
  PublicWidgetAskResponse,
  PublicWidgetLeadResponse,
  PublicWidgetRecommendedListing,
  TenantSnapshot,
  AiChatCitation,
  AiChatReferencedListing,
  AiChatTurn,
  TenantWidgetLanguage
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { LeadService } from "../../../leads/application/lead.service.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../../properties/domain/property.repository.js";
import { TenantService } from "../../../tenants/application/tenant.service.js";
import type { AiConciergePersona } from "../../application/ai-text-generator.js";
import { AiChatService } from "../../application/ai-chat.service.js";
import { LocationIntelligenceService } from "../../application/location-intelligence.js";
import { PublicWidgetRateLimitService } from "../../application/public-widget-rate-limit.service.js";
import { PublicWidgetAskDto, PublicWidgetLeadDto } from "./public-widget-chat.dto.js";

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

interface WidgetLocationTarget {
  aliases: string[];
  label: string;
  latitude: number;
  longitude: number;
}

const WIDGET_LOCATION_TARGETS: Partial<Record<PropertySnapshot["market"], WidgetLocationTarget[]>> = {
  pattaya: [
    {
      aliases: ["central pattaya", "central festival", "central pattaya mall", "центр паттайи", "центральная паттайя"],
      label: "Central Pattaya",
      latitude: 12.9348,
      longitude: 100.8832
    },
    {
      aliases: ["walking street", "pattaya walking street"],
      label: "Walking Street",
      latitude: 12.9279,
      longitude: 100.8738
    },
    {
      aliases: ["boyz town", "boyztown", "boys town"],
      label: "Boyz Town",
      latitude: 12.9298,
      longitude: 100.8789
    },
    {
      aliases: ["asia pattaya hotel", "asia pattaya beach hotel", "asia hotel pattaya", "отель asia pattaya", "азия паттайя отель"],
      label: "Asia Pattaya Hotel",
      latitude: 12.914206,
      longitude: 100.858419
    },
    {
      aliases: ["terminal 21", "terminal 21 pattaya"],
      label: "Terminal 21 Pattaya",
      latitude: 12.9497,
      longitude: 100.889
    },
    {
      aliases: ["ramayana water park", "water park ramayana", "ramayana", "аквапарк рамаяна", "рамаяна"],
      label: "Ramayana Water Park",
      latitude: 12.75045,
      longitude: 100.96204
    }
  ]
};

@Controller("public/v1/widget")
@ApiTags("public-widget")
export class PublicWidgetChatController {
  constructor(
    @Inject(TenantService) private readonly tenants: TenantService,
    @Inject(AiChatService) private readonly chat: AiChatService,
    @Inject(LeadService) private readonly leads: LeadService,
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(PublicWidgetRateLimitService) private readonly rateLimits: PublicWidgetRateLimitService,
    @Inject(LocationIntelligenceService)
    private readonly locationIntelligence: LocationIntelligenceService = new LocationIntelligenceService()
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
    const tenant = await this.tenants.getActiveTenantBySlugOrThrow(tenantSlug, "Widget tenant not found");
    assertPublicWidgetAskPayloadBounds(payload);
    this.tenants.assertPublicWidgetOriginAllowed(tenant, origin, referer);
    await this.rateLimits.checkPublicWidgetAsk({
      ip: resolveClientIp(request),
      sessionId: payload.sessionId,
      tenantId: tenant.id
    });

    const locale = resolveWidgetLocale(tenant.widget.languages, payload.locale);
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
    await this.tenants.recordPublicWidgetAsk(tenant, {
      locale,
      origin: origin ?? null,
      referer: referer ?? null
    });
    const recommendations = await this.buildRecommendedListings(
      tenant,
      response.matchedPropertyIds,
      origin,
      referer,
      locale,
      payload
    );

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

    if (!contactEmail && !contactPhone) {
      throw new BadRequestException("Email or phone is required for widget handoff");
    }

    const lead = await this.leads.create(tenant.id, {
      contactEmail,
      contactName: payload.contactName.trim(),
      contactPhone,
      message: buildQualifiedLeadMessage(payload),
      preferredLocale: locale,
      propertyId: resolveLeadPropertyId(payload),
      source: "ai-concierge"
    });

    return {
      conciergeMode: tenant.subscriptionPlan,
      leadId: lead.id,
      locale,
      message:
        tenant.subscriptionPlan === "starter"
          ? "Thanks. The agency has your qualified request and can follow up."
          : "Thanks. The agency has your request and can follow up from CRM.",
      status: lead.status,
      tenantSlug: tenant.slug
    };
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
    const rankedPublicProperties = rankWidgetPropertiesForRequest(strictPublicProperties, searchContext, locationTarget);
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
      totalMatches: strictPublicProperties.length
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

  const labels: Record<TenantWidgetLanguage, string> = {
    en: "I do not have public listing cards to show for this exact search right now. You can adjust the budget, area, radius, or requirements and I can look again.",
    ru: "Сейчас нет публичных карточек под этот точный поиск. Можно изменить бюджет, район, радиус или требования, и я поищу заново.",
    th: "ตอนนี้ยังไม่มีการ์ดประกาศสาธารณะที่ตรงกับการค้นหานี้ ลองปรับงบ ทำเล รัศมี หรือเงื่อนไข แล้วฉันจะค้นหาให้อีกครั้ง",
    zh: "目前没有符合这个精确搜索的公开房源卡片。你可以调整预算、区域、半径或条件，我再帮你查找。"
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
    ru: `Я нашла ${countText} подходящих вариантов. Ниже топ-${shownCount}, которые можно открыть сейчас.`,
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
  const amenities = summarizeAmenities(properties, requestMessage);
  const suitability = summarizeRequestSuitability(properties, locale, requestMessage);
  const details = [priceRange, bedroomSummary, areaSummary, locationSummary, beachSummary, amenities].filter(Boolean);
  const clarificationPrompt = buildRecommendationClarificationPrompt(requestMessage, locale);

  const overviewLabels: Record<TenantWidgetLanguage, string> = {
    en: `These ${kind} options fit the ${market} search${details.length ? ` because they include ${details.join(", ")}` : ""}. Open the cards to compare exact photos, availability, and viewing details.`,
    ru: `Эти варианты ${kind} подходят под поиск в ${market}${details.length ? `: ${details.join(", ")}` : ""}. Откройте карточки, чтобы сравнить фото, наличие и детали просмотра.`,
    th: `ตัวเลือก${kind}เหล่านี้เหมาะกับการค้นหาใน ${market}${details.length ? ` เพราะมี ${details.join(", ")}` : ""} เปิดการ์ดเพื่อดูรูป ความพร้อม และรายละเอียดนัดชม`,
    zh: `这些${kind}选项符合 ${market} 搜索${details.length ? `，因为包含${details.join("、")}` : ""}。打开卡片可查看照片、可售状态和看房细节。`
  };
  const cardDescriptions = properties.map((property) => buildListingCardDescription(property, locale, priceMode, locationTarget));

  return [overviewLabels[locale] ?? overviewLabels.en, suitability, clarificationPrompt, ...cardDescriptions].filter(Boolean).join("\n");
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

  if (
    !requestedAmenities.length &&
    !preferBudgetPrice &&
    !preferLuxuryFit &&
    !preferValueForMoney &&
    !preferLargerArea &&
    !locationTarget &&
    !preferCloseBeach &&
    !preferFamilyFit
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

      if (preferBudgetPrice) {
        const priceDelta = widgetComparablePrice(left.property) - widgetComparablePrice(right.property);
        if (priceDelta !== 0) {
          return priceDelta;
        }
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

  return filtered.length ? filtered : properties;
}

function detectWidgetBedroomRange(message: string): { minBedrooms?: number; maxBedrooms?: number } {
  const normalized = message.toLowerCase();
  const studioPattern = String.raw`(?:\b(?:studio)\b|студия|студию|สตูดิโอ|开间|開間|单间|單間)`;
  const oneBedroomPattern = String.raw`(?:\b(?:1|one)\s*(?:bedroom|bedrooms|br|bed|beds)\b|однушк|однокомнат|1\s*спальн)`;
  const studioOrOneBedroom = new RegExp(
    `(?:${studioPattern}.{0,40}(?:or|/|или).{0,40}${oneBedroomPattern}|${oneBedroomPattern}.{0,40}(?:or|/|или).{0,40}${studioPattern})`,
    "i"
  );

  if (studioOrOneBedroom.test(normalized)) {
    return { minBedrooms: 0, maxBedrooms: 1 };
  }

  const explicit = normalized.match(/(\d+)\s*(?:bedroom|bedrooms|br|спальн|спальни|спален|ห้องนอน|卧室|臥室|房间|房間|房)/);
  if (explicit?.[1]) {
    const bedrooms = Number(explicit[1]);
    const exactRequest = hasExactWidgetBedroomQualifier(normalized, explicit[0]);
    return exactRequest ? { minBedrooms: bedrooms, maxBedrooms: bedrooms } : { minBedrooms: bedrooms };
  }

  if (new RegExp(studioPattern, "i").test(normalized)) {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function isBudgetPriceRequest(message: string) {
  return /\b(?:budget-friendly|budget option|cheap|cheaper|affordable|low price|lowest price|economy|inexpensive)\b|бюджетн|дешев|недорог|подешевле|ประหยัด|ถูก|ราคาไม่แพง|便宜|实惠|實惠/i.test(message);
}

function isLuxuryRequest(message: string) {
  return /\b(?:luxury|premium|elite|high-end|upscale|exclusive|best quality)\b|элит|премиум|люкс|дорог|ระดับพรีเมียม|หรู|豪华|豪華|高端/i.test(message);
}

function isValueForMoneyRequest(message: string) {
  return /\b(?:best value|value for money|good deal|best deal|balanced|optimal|worth it)\b|цена.*качество|лучшее предложение|выгод|оптимальн|คุ้มค่า|性价比|性價比/i.test(message);
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
  return /\b(?:rent|rental|lease|monthly|per month)\b|аренд|снять|เช่า|รายเดือน|ต่อเดือน|租房|租公寓|月租|每月/i.test(message);
}

function hasSaleIntent(message: string) {
  return /\b(?:buy|purchase|sale|ownership|freehold|invest|investment)\b|купить|покуп|продаж|собствен|инвест|ซื้อ|ขาย|买|買|购买|購買|投资|投資/i.test(message);
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

function summarizeBedrooms(properties: PropertySnapshot[], locale: TenantWidgetLanguage): string {
  const bedrooms = Array.from(new Set(properties.map((property) => property.bedrooms ?? 0))).sort((left, right) => left - right);

  if (!bedrooms.length) {
    return "";
  }

  const value =
    bedrooms.length === 1
      ? bedrooms[0] === 0
        ? "studio"
        : String(bedrooms[0])
      : bedrooms[0] === 0
        ? `studio-${bedrooms[bedrooms.length - 1]}`
        : `${bedrooms[0]}-${bedrooms[bedrooms.length - 1]}`;
  const labels: Record<TenantWidgetLanguage, string> = {
    en: value === "studio" ? "studio layouts" : `${value} bedroom${value === "1" ? "" : "s"}`,
    ru: `${value} спальн.`,
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

function summarizeSingleLocationTargetDistance(property: PropertySnapshot, target?: WidgetLocationTarget): string {
  return target ? `about ${formatDistance(distanceMeters(property.location, target))} from ${target.label}` : "";
}

function summarizeAmenities(properties: PropertySnapshot[], requestMessage = ""): string {
  const allAmenities = Array.from(new Set(properties.flatMap((property) => property.amenities ?? []).filter(Boolean)));
  const requestedAmenities = detectRequestedWidgetAmenities(requestMessage).filter((amenity) =>
    properties.some((property) => hasAnyAmenity(property, amenity === "pet-friendly" ? ["pet-friendly", "pets-allowed"] : [amenity]))
  );
  const amenities = [
    ...requestedAmenities,
    ...allAmenities.filter((amenity) => !requestedAmenities.includes(amenity))
  ].slice(0, 3);

  return amenities.length ? `amenities like ${amenities.join(", ")}` : "";
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
    summarizeSingleLocationTargetDistance(property, locationTarget),
    summarizeBeachDistance([property], locale),
    summarizeAmenities([property])
  ].filter(Boolean);
  const detail = facts.length ? facts.join(", ") : formatMarketLabel(property.market);

  return `${property.title}: ${detail}.`;
}

function resolveStaticWidgetLocationTarget(message: string, market?: PropertySnapshot["market"]): WidgetLocationTarget | undefined {
  const normalized = normalizeLocationText(message);
  const targets = market ? WIDGET_LOCATION_TARGETS[market] ?? [] : Object.values(WIDGET_LOCATION_TARGETS).flat();

  return targets.find((target) => target.aliases.some((alias) => normalized.includes(normalizeLocationText(alias))));
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

  if ((payload.conversation ?? []).length > 12) {
    throw new BadRequestException("Widget conversation history must include 12 turns or fewer");
  }

  for (const turn of payload.conversation ?? []) {
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
  return payload.recommendedListings?.find((listing: AiChatReferencedListing) => listing.propertyId.trim())?.propertyId.trim();
}

function buildQualifiedLeadMessage(payload: PublicWidgetLeadDto): string | undefined {
  const lines = ["Widget handoff request."];
  const visitorNote = normalizeOptional(payload.message);
  const recommendedListings: AiChatReferencedListing[] = (payload.recommendedListings ?? []).slice(0, 3);
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

function buildLeadQualificationSection(payload: PublicWidgetLeadDto): string | undefined {
  const source = [
    payload.message,
    ...(payload.conversation ?? []).filter((turn: AiChatTurn) => turn.role === "user").map((turn: AiChatTurn) => turn.text)
  ]
    .filter(Boolean)
    .join("\n");
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
    /(?:under|below|max|up to|budget|до|менее|не больше|ไม่เกิน|ต่ำกว่า|งบ|预算|預算|预算是|預算是|不超过|不超過|低于|低於)\s*[0-9]+(?:[.,][0-9]+)?\s*(?:m|million|млн|ล้าน|百万|百萬|万|萬|k|thousand|тыс)?\s*(?:thb|baht|бат|บาท|泰铢|泰銖)?(?:\s*(?:per month|monthly|month|месяц|мес|ต่อเดือน|รายเดือน|每月|月租))?/i,
    /[0-9]+(?:[.,][0-9]+)?\s*(?:m|million|млн|ล้าน|百万|百萬|万|萬|k|thousand|тыс)\s*(?:thb|baht|бат|บาท|泰铢|泰銖)?(?:\s*(?:per month|monthly|month|месяц|мес|ต่อเดือน|รายเดือน|每月|月租))?/i,
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
    /(?:move[-\s]?in|available from|start from|from|заезд|въезд|въезжаю|въехать|заехать|с\s+|ย้ายเข้า|入住)\s+(today|tomorrow|next week|next month|this weekend|[0-9]{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)|[0-9]{1,2}[./-][0-9]{1,2}(?:[./-][0-9]{2,4})?|сегодня|завтра|на следующей неделе|в следующем месяце|через\s+(?:\d+|один|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать)\s+дн\w*|เดือนหน้า|พรุ่งนี้|明天|下周|下週|下个月|下個月)/i
  );

  return match?.[1] ? normalizeQualificationValue(match[1]) : undefined;
}

function parseContractLength(text: string): string | undefined {
  const match = text.match(
    /(?:for|contract|lease|term|на|контракт|срок|สัญญา|租期)\s*([0-9]+(?:[.,][0-9]+)?\s*(?:months|month|years|year|mo|мес|месяцев|месяца|месяц|года|год|лет|เดือน|ปี|个月|個月|年))|([0-9]+(?:[.,][0-9]+)?\s*(?:months|month|years|year|mo|мес|месяцев|месяца|месяц|года|год|лет|เดือน|ปี|个月|個月|年)\s*(?:contract|lease|term|контракт|договор|สัญญา|租期)?)/i
  );

  return match?.[1] || match?.[2] ? normalizeQualificationValue(match[1] ?? match[2]!) : undefined;
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

  if (/(telegram|телеграм)/i.test(normalized)) {
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
  /next week|next month|this weekend|weekend|day after tomorrow|tomorrow(?:\s+(?:morning|afternoon|evening|night))?|today(?:\s+(?:morning|afternoon|evening|night))?|in\s+[0-9]+\s+days?|within\s+[0-9]+\s+(?:days|weeks|months)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+[0-9]{1,2}(?::[0-9]{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?|[0-9]{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+at\s+[0-9]{1,2}(?::[0-9]{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?|следующ(?:ей|ий|ем)\s+\S+|через\s+[0-9]+\s+дн\w*|на\s+выходных|в\s+выходные|послезавтра|завтра(?:\s+(?:утром|днем|днём|вечером))?|сегодня(?:\s+(?:утром|днем|днём|вечером))?|วัน(?:นี้|พรุ่งนี้)|พรุ่งนี้|สัปดาห์หน้า|เดือนหน้า|明天(?:上午|下午|晚上)?|今天(?:上午|下午|晚上)?|后天|後天|周末|週末|下周|下週|下个月|下個月/gi;

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
