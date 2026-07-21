import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  PublicWidgetConfigResponse,
  TenantSnapshot,
  TenantWidgetLanguage,
  TenantWidgetTone,
  TenantUsageMetric,
  TenantUsageResponse,
  UpdateTenantSettingsRequest
} from "@propertyflow/contracts";
import { TENANT_REPOSITORY, type TenantRepository } from "../domain/tenant.repository.js";

@Injectable()
export class TenantService {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository) {}

  async findActiveTenant(tenantId: string): Promise<TenantSnapshot | null> {
    const tenant = await this.tenants.findById(tenantId);

    if (!tenant || tenant.status !== "active") {
      return null;
    }

    return tenant;
  }

  async getActiveTenantOrThrow(tenantId: string): Promise<TenantSnapshot> {
    const tenant = await this.findActiveTenant(tenantId);

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }

  async getActiveTenantBySlugOrThrow(slug: string, message = "Tenant not found"): Promise<TenantSnapshot> {
    const tenant = await this.tenants.findBySlug(slug);

    if (!tenant || tenant.status !== "active") {
      throw new NotFoundException(message);
    }

    return tenant;
  }

  async getPublicWidgetConfig(slug: string): Promise<PublicWidgetConfigResponse> {
    const tenant = await this.getActiveTenantBySlugOrThrow(slug, "Widget tenant not found");

    return {
      aiName: tenant.widget.aiName,
      aiNames: tenant.widget.aiNames,
      branding: tenant.branding,
      conciergeMode: tenant.subscriptionPlan,
      languages: tenant.widget.languages,
      personaGenders: tenant.widget.personaGenders,
      tenantSlug: tenant.slug,
      tone: tenant.widget.tone,
      welcomeMessage: tenant.widget.welcomeMessage,
      welcomeMessages: tenant.widget.welcomeMessages
    };
  }

  async getUsage(tenantId: string): Promise<TenantUsageResponse> {
    const tenant = await this.getActiveTenantOrThrow(tenantId);
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const usage = await this.tenants.getUsage(tenantId, periodStart, periodEnd);

    return {
      tenantId,
      subscriptionPlan: tenant.subscriptionPlan,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      items: [
        this.toUsageMetric("properties", usage.properties, tenant.limits.properties),
        this.toUsageMetric("agents", usage.agents, tenant.limits.agents),
        this.toUsageMetric("aiCreditsMonthly", usage.aiCreditsMonthly, tenant.limits.aiCreditsMonthly),
        this.toUsageMetric(
          "publicApiRequestsMonthly",
          usage.publicApiRequestsMonthly,
          tenant.limits.publicApiRequestsMonthly
        )
      ],
      generatedAt: now.toISOString()
    };
  }

  async updateSettings(tenantId: string, request: UpdateTenantSettingsRequest): Promise<TenantSnapshot> {
    const tenant = await this.tenants.updateSettings(tenantId, normalizeUpdateTenantSettingsRequest(request));

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }

  private toUsageMetric(key: TenantUsageMetric["key"], used: number, limit: number): TenantUsageMetric {
    return {
      key,
      used,
      limit,
      remaining: Math.max(limit - used, 0),
      utilizationRate: limit > 0 ? Math.round((used / limit) * 10_000) / 100 : 0
    };
  }
}

const supportedWidgetLanguages: TenantWidgetLanguage[] = ["en", "ru", "th", "zh"];
const supportedPersonaGenders = ["feminine", "masculine", "neutral"] as const;
const supportedWidgetTones: TenantWidgetTone[] = ["friendly", "professional", "luxury", "concise"];

function normalizeUpdateTenantSettingsRequest(request: UpdateTenantSettingsRequest): UpdateTenantSettingsRequest {
  const languages = request.widget?.languages
    ?.map((language) => language.trim().toLowerCase())
    .filter((language, index, values): language is TenantWidgetLanguage =>
      supportedWidgetLanguages.includes(language as TenantWidgetLanguage) && values.indexOf(language) === index
    );
  const aiNames = normalizeLocalizedStrings(request.widget?.aiNames);
  const welcomeMessages = normalizeLocalizedStrings(request.widget?.welcomeMessages);
  const personaGenders = normalizePersonaGenders(request.widget?.personaGenders);

  return {
    ...request,
    widget: request.widget
      ? {
          ...request.widget,
          aiName: request.widget.aiName?.trim() || undefined,
          aiNames,
          languages: languages?.length ? languages : undefined,
          personaGenders,
          tone: normalizeWidgetTone(request.widget.tone),
          welcomeMessage: request.widget.welcomeMessage?.trim() || welcomeMessages?.en || undefined,
          welcomeMessages
        }
      : undefined
  };
}

function normalizeWidgetTone(tone: TenantWidgetTone | undefined) {
  return tone && supportedWidgetTones.includes(tone) ? tone : undefined;
}

function normalizeLocalizedStrings(values: Partial<Record<TenantWidgetLanguage, string>> | undefined) {
  if (!values) {
    return undefined;
  }

  return supportedWidgetLanguages.reduce<Partial<Record<TenantWidgetLanguage, string>>>((normalized, language) => {
    const value = values[language]?.trim();

    if (value) {
      normalized[language] = value;
    }

    return normalized;
  }, {});
}

function normalizePersonaGenders(
  values: Partial<Record<TenantWidgetLanguage, (typeof supportedPersonaGenders)[number]>> | undefined
) {
  if (!values) {
    return undefined;
  }

  return supportedWidgetLanguages.reduce<Partial<Record<TenantWidgetLanguage, (typeof supportedPersonaGenders)[number]>>>(
    (normalized, language) => {
      const value = values[language];

      if (supportedPersonaGenders.includes(value as (typeof supportedPersonaGenders)[number])) {
        normalized[language] = value;
      }

      return normalized;
    },
    {}
  );
}
