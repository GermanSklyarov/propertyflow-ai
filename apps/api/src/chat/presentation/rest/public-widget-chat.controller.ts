import { BadRequestException, Body, Controller, ForbiddenException, Headers, Inject, Param, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type {
  PublicWidgetAskResponse,
  PublicWidgetLeadResponse,
  PublicWidgetRecommendedListing,
  TenantSnapshot,
  TenantWidgetLanguage
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { LeadService } from "../../../leads/application/lead.service.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../../properties/domain/property.repository.js";
import { TenantService } from "../../../tenants/application/tenant.service.js";
import type { AiConciergePersona } from "../../application/ai-text-generator.js";
import { AiChatService } from "../../application/ai-chat.service.js";
import { PublicWidgetAskDto, PublicWidgetLeadDto } from "./public-widget-chat.dto.js";

@Controller("public/v1/widget")
@ApiTags("public-widget")
export class PublicWidgetChatController {
  constructor(
    @Inject(TenantService) private readonly tenants: TenantService,
    @Inject(AiChatService) private readonly chat: AiChatService,
    @Inject(LeadService) private readonly leads: LeadService,
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository
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
    @Headers("origin") origin?: string,
    @Headers("referer") referer?: string
  ): Promise<PublicWidgetAskResponse> {
    const tenant = await this.tenants.getActiveTenantBySlugOrThrow(tenantSlug, "Widget tenant not found");
    this.tenants.assertPublicWidgetOriginAllowed(tenant, origin, referer);

    const locale = resolveWidgetLocale(tenant.widget.languages, payload.locale);
    const response = await this.chat.ask(
      tenant.id,
      {
        ...payload,
        locale
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
  @ApiOperation({ summary: "Create a tenant-scoped Growth or Enterprise lead from the public AI Concierge widget" })
  @ApiParam({ name: "tenantSlug", example: "demo-agency" })
  @ApiOkResponse({
    description: "Lead captured from a Growth or Enterprise public widget handoff without exposing a public API key",
    schema: {
      example: {
        conciergeMode: "growth",
        leadId: "lead-1",
        locale: "en",
        message: "Thanks. The agency has your request and can follow up from CRM.",
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

    if (tenant.subscriptionPlan === "starter") {
      throw new ForbiddenException("Widget CRM handoff requires Growth or Enterprise mode");
    }

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
      message: normalizeOptional(payload.message),
      preferredLocale: locale,
      source: "ai-concierge"
    });

    return {
      conciergeMode: tenant.subscriptionPlan,
      leadId: lead.id,
      locale,
      message: "Thanks. The agency has your request and can follow up from CRM.",
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
    name: tenant.widget.aiNames[locale] ?? tenant.widget.aiName,
    tone: tenant.widget.tone,
    welcomeMessage: tenant.widget.welcomeMessages[locale] ?? tenant.widget.welcomeMessage
  };
}

function normalizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
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
