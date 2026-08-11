import { BadRequestException, Body, Controller, Headers, Inject, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type {
  PublicWidgetAskResponse,
  PublicWidgetLeadResponse,
  PublicWidgetRecommendedListing,
  TenantSnapshot,
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
  fitSummary: string;
  listings: PublicWidgetRecommendedListing[];
  totalMatches?: number;
}

@Controller("public/v1/widget")
@ApiTags("public-widget")
export class PublicWidgetChatController {
  constructor(
    @Inject(TenantService) private readonly tenants: TenantService,
    @Inject(AiChatService) private readonly chat: AiChatService,
    @Inject(LeadService) private readonly leads: LeadService,
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(PublicWidgetRateLimitService) private readonly rateLimits: PublicWidgetRateLimitService
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
      answer: normalizePublicWidgetAnswer(response.answer, recommendations, locale, response.suggestedActions),
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
        fitSummary: "",
        listings: [],
        totalMatches: propertyIds.length
      };
    }

    const excludedPropertyIds = payload && isMoreListingsRequest(payload.message) ? getShownListingIds(payload.conversation) : new Set<string>();
    const visiblePropertyIds = propertyIds.filter((propertyId) => !excludedPropertyIds.has(propertyId));
    const idsToLoad = visiblePropertyIds.length ? visiblePropertyIds : propertyIds;
    const properties = await Promise.all(idsToLoad.slice(0, 8).map((propertyId) => this.properties.findById(tenant.id, propertyId)));
    const matchedProperties = properties
      .filter((property): property is PropertySnapshot => Boolean(property))
      .filter(isPublicWidgetRecommendableProperty)
      .slice(0, 3);

    return {
      fitSummary: buildListingFitSummary(matchedProperties, locale),
      listings: matchedProperties.map((property) => ({
        propertyId: property.id,
        title: property.title,
        url: buildListingUrl(baseOrigin, listingUrlTemplate, property.id)
      })),
      totalMatches: propertyIds.length
    };
  }
}

function getShownListingIds(conversation?: AiChatTurn[]): Set<string> {
  return new Set(
    (conversation ?? [])
      .flatMap((turn) => turn.recommendedListings ?? [])
      .map((listing) => listing.propertyId.trim())
      .filter(Boolean)
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
  suggestedActions: string[]
): string {
  const normalizedAnswer = stripMarkdownEmphasis(answer).trim();

  if (!recommendations.listings.length && suggestedActions.includes("save-search")) {
    return buildNoAdditionalListingCardsMessage(locale);
  }

  if (!recommendations.listings.length || !isListingDiscoveryResponse(suggestedActions)) {
    return normalizedAnswer;
  }

  return [buildListingCardIntro(normalizedAnswer, recommendations.listings.length, locale, recommendations.totalMatches), recommendations.fitSummary]
    .filter(Boolean)
    .join("\n\n");
}

function isListingDiscoveryResponse(suggestedActions: string[]): boolean {
  return suggestedActions.includes("save-search");
}

function buildNoAdditionalListingCardsMessage(locale: TenantWidgetLanguage): string {
  const labels: Record<TenantWidgetLanguage, string> = {
    en: "I do not have additional public listing cards to show for this search right now. You can adjust the budget, area, or requirements and I can look again.",
    ru: "Сейчас у меня нет дополнительных публичных карточек по этому поиску. Можно изменить бюджет, район или требования, и я поищу заново.",
    th: "ตอนนี้ยังไม่มีการ์ดประกาศเพิ่มเติมสำหรับการค้นหานี้ ลองปรับงบ ทำเล หรือเงื่อนไข แล้วฉันจะค้นหาให้อีกครั้ง",
    zh: "目前这个搜索没有更多可公开展示的房源卡片。你可以调整预算、区域或条件，我再帮你重新查找。"
  };

  return labels[locale] ?? labels.en;
}

function isMoreListingsRequest(message: string): boolean {
  return /\b(?:more|another|other|else|all|everything|next|show\s+all|see\s+all)\b|еще|ещё|друг|остальн|все вариант|покажи все|เพิ่มเติม|ทั้งหมด|其他|更多|全部|所有/i.test(
    message
  );
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
  totalMatches?: number
): string {
  const matchCount = answer.match(/\b(\d{1,4})\b/)?.[1];
  const countText = totalMatches && totalMatches > shownCount ? String(totalMatches) : matchCount ?? String(shownCount);
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

function buildListingFitSummary(properties: PropertySnapshot[], locale: TenantWidgetLanguage): string {
  if (!properties.length) {
    return "";
  }

  const market = formatMarketLabel(properties[0]?.market);
  const kind = formatKindLabel(properties[0]?.kind);
  const priceRange = formatPriceRange(properties);
  const bedroomSummary = summarizeBedrooms(properties, locale);
  const areaSummary = summarizeArea(properties, locale);
  const beachSummary = summarizeBeachDistance(properties, locale);
  const amenities = summarizeAmenities(properties);
  const details = [priceRange, bedroomSummary, areaSummary, beachSummary, amenities].filter(Boolean);

  const overviewLabels: Record<TenantWidgetLanguage, string> = {
    en: `These ${kind} options fit the ${market} search${details.length ? ` because they include ${details.join(", ")}` : ""}. Open the cards to compare exact photos, availability, and viewing details.`,
    ru: `Эти варианты ${kind} подходят под поиск в ${market}${details.length ? `: ${details.join(", ")}` : ""}. Откройте карточки, чтобы сравнить фото, наличие и детали просмотра.`,
    th: `ตัวเลือก${kind}เหล่านี้เหมาะกับการค้นหาใน ${market}${details.length ? ` เพราะมี ${details.join(", ")}` : ""} เปิดการ์ดเพื่อดูรูป ความพร้อม และรายละเอียดนัดชม`,
    zh: `这些${kind}选项符合 ${market} 搜索${details.length ? `，因为包含${details.join("、")}` : ""}。打开卡片可查看照片、可售状态和看房细节。`
  };
  const cardDescriptions = properties.map((property) => buildListingCardDescription(property, locale));

  return [overviewLabels[locale] ?? overviewLabels.en, ...cardDescriptions].filter(Boolean).join("\n");
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

function formatPriceRange(properties: PropertySnapshot[]): string {
  const rentalPrices = properties.flatMap((property) =>
    property.rentalPriceMonthly && property.rentalPriceMonthly.amount >= 1_000 ? [property.rentalPriceMonthly] : []
  );
  const shouldShowRent =
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
  const bedrooms = Array.from(new Set(properties.map((property) => property.bedrooms ?? 0).filter((value) => value > 0))).sort(
    (left, right) => left - right
  );

  if (!bedrooms.length) {
    return "";
  }

  const value = bedrooms.length === 1 ? String(bedrooms[0]) : `${bedrooms[0]}-${bedrooms[bedrooms.length - 1]}`;
  const labels: Record<TenantWidgetLanguage, string> = {
    en: `${value} bedroom${value === "1" ? "" : "s"}`,
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

function summarizeAmenities(properties: PropertySnapshot[]): string {
  const amenities = Array.from(new Set(properties.flatMap((property) => property.amenities ?? []).filter(Boolean))).slice(0, 3);

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

function buildListingCardDescription(property: PropertySnapshot, locale: TenantWidgetLanguage): string {
  const facts = [
    formatPriceRange([property]),
    summarizeBedrooms([property], locale),
    summarizeArea([property], locale),
    summarizeBeachDistance([property], locale),
    summarizeAmenities([property])
  ].filter(Boolean);
  const detail = facts.length ? facts.join(", ") : formatMarketLabel(property.market);

  return `${property.title}: ${detail}.`;
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
  const details = [
    parseDealIntent(source) ? `Intent: ${parseDealIntent(source)}` : undefined,
    parseBudget(source) ? `Budget: ${parseBudget(source)}` : undefined,
    parsePurpose(source) ? `Purpose: ${parsePurpose(source)}` : undefined,
    parseOwnershipStructure(source) ? `Ownership/quota: ${parseOwnershipStructure(source)}` : undefined,
    parsePurchaseTiming(source) ? `Purchase timing: ${parsePurchaseTiming(source)}` : undefined,
    parseMoveInDate(source) ? `Move-in: ${parseMoveInDate(source)}` : undefined,
    parseContractLength(source) ? `Contract length: ${parseContractLength(source)}` : undefined,
    parseTiming(source) ? `Timing: ${parseTiming(source)}` : undefined,
    parseContactPreference(source) ? `Contact channel: ${parseContactPreference(source)}` : undefined
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

  if (!/(rent|rental|lease|move in|move-in|аренд|снять|заехать|въезд|เช่า|ย้ายเข้า|入住|租)/i.test(normalized)) {
    return undefined;
  }

  const match = normalized.match(
    /(?:move[-\s]?in|available from|start from|from|заезд|въезд|заехать|с\s+|ย้ายเข้า|入住)\s+(today|tomorrow|next week|next month|this weekend|[0-9]{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)|[0-9]{1,2}[./-][0-9]{1,2}(?:[./-][0-9]{2,4})?|сегодня|завтра|на следующей неделе|в следующем месяце|เดือนหน้า|พรุ่งนี้|明天|下周|下週|下个月|下個月)/i
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
    { label: "Family living", pattern: /(family|school|семь|семья|школ|ครอบครัว|โรงเรียน|家庭|学校|學校)/gi },
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

function parseTiming(text: string): string | undefined {
  const matches = [
    ...text.matchAll(
      /next week|next month|this weekend|weekend|day after tomorrow|tomorrow|today|in\s+[0-9]+\s+days?|within\s+[0-9]+\s+(?:days|weeks|months)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+[0-9]{1,2}(?::[0-9]{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?|[0-9]{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+at\s+[0-9]{1,2}(?::[0-9]{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?|следующ(?:ей|ий|ем)\s+\S+|через\s+[0-9]+\s+дн\w*|на\s+выходных|в\s+выходные|послезавтра|завтра|сегодня|วัน(?:นี้|พรุ่งนี้)|สัปดาห์หน้า|เดือนหน้า|明天|今天|后天|後天|周末|週末|下周|下週|下个月|下個月/gi
    )
  ];
  const match = matches.at(-1);

  return match?.[0] ? normalizeQualificationValue(match[0]) : undefined;
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
