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
    const recommendedListings = await this.buildRecommendedListings(tenant, response.matchedPropertyIds, origin, referer);

    return {
      ...response,
      conciergeMode: tenant.subscriptionPlan,
      locale,
      recommendedListings,
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
    referer?: string
  ): Promise<PublicWidgetRecommendedListing[]> {
    const baseOrigin = resolveRequestOrigin(origin) ?? resolveRequestOrigin(referer);
    const listingUrlTemplate = normalizeListingUrlTemplate(tenant.widget.listingUrlTemplate);

    if (!baseOrigin) {
      return [];
    }

    const properties = await Promise.all(
      propertyIds.slice(0, 3).map((propertyId) => this.properties.findById(tenant.id, propertyId))
    );

    return properties
      .filter((property): property is PropertySnapshot => Boolean(property))
      .map((property) => ({
        propertyId: property.id,
        title: property.title,
        url: buildListingUrl(baseOrigin, listingUrlTemplate, property.id)
      }));
  }
}

function resolveWidgetLocale(enabledLanguages: TenantWidgetLanguage[], requestedLocale: TenantWidgetLanguage): TenantWidgetLanguage {
  if (enabledLanguages.includes(requestedLocale)) {
    return requestedLocale;
  }

  return enabledLanguages[0] ?? "en";
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
    parseBudget(source) ? `Budget: ${parseBudget(source)}` : undefined,
    parsePurpose(source) ? `Purpose: ${parsePurpose(source)}` : undefined,
    parseTiming(source) ? `Timing: ${parseTiming(source)}` : undefined,
    parseContactPreference(source) ? `Contact channel: ${parseContactPreference(source)}` : undefined
  ].filter(Boolean);

  return details.length ? ["Lead qualification:", ...details].join("\n") : undefined;
}

function parseBudget(text: string): string | undefined {
  const match = [
    /(?:under|below|max|up to|budget|до|менее|не больше|ไม่เกิน|ต่ำกว่า|งบ|预算|預算|预算是|預算是|不超过|不超過|低于|低於)\s*[0-9]+(?:[.,][0-9]+)?\s*(?:m|million|млн|ล้าน|百万|百萬|万|萬|k|thousand|тыс)?\s*(?:thb|baht|бат|บาท|泰铢|泰銖)?(?:\s*(?:per month|monthly|month|месяц|мес|ต่อเดือน|รายเดือน|每月|月租))?/i,
    /[0-9]+(?:[.,][0-9]+)?\s*(?:m|million|млн|ล้าน|百万|百萬|万|萬|k|thousand|тыс)\s*(?:thb|baht|бат|บาท|泰铢|泰銖)?(?:\s*(?:per month|monthly|month|месяц|мес|ต่อเดือน|รายเดือน|每月|月租))?/i,
    /[0-9][0-9\s,.]*\s*(?:thb|baht|бат|บาท|泰铢|泰銖)(?:\s*(?:per month|monthly|month|месяц|мес|ต่อเดือน|รายเดือน|每月|月租))?/i
  ].map((pattern) => text.match(pattern)).find(Boolean);

  return match?.[0] ? normalizeQualificationValue(match[0]) : undefined;
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
      /next week|next month|monday(?:\s+at\s+[0-9]{1,2}(?::[0-9]{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?|tomorrow|today|within\s+[0-9]+\s+(?:days|weeks|months)|следующ(?:ей|ий|ем)\s+\S+|завтра|сегодня|วัน(?:นี้|พรุ่งนี้)|สัปดาห์หน้า|เดือนหน้า|明天|今天|下周|下週|下个月|下個月/gi
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
