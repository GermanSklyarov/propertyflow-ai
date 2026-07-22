import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  PublicWidgetConfigResponse,
  PublicWidgetReadiness,
  PublicWidgetReadinessCheck,
  TenantSnapshot,
  TenantWidgetInstallCheckItem,
  TenantWidgetInstallCheckResponse,
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
      allowedOriginsConfigured: tenant.widget.allowedOrigins.length > 0,
      branding: tenant.branding,
      capabilities: buildPublicWidgetCapabilities(tenant),
      conciergeMode: tenant.subscriptionPlan,
      languages: tenant.widget.languages,
      personaGenders: tenant.widget.personaGenders,
      readiness: buildPublicWidgetReadiness(tenant),
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

  assertPublicWidgetOriginAllowed(tenant: TenantSnapshot, originHeader?: string, refererHeader?: string): void {
    if (!tenant.widget.allowedOrigins.length) {
      return;
    }

    const requestOrigin = normalizeRequestOrigin(originHeader) ?? normalizeRequestOrigin(refererHeader);

    if (!requestOrigin || !tenant.widget.allowedOrigins.includes(requestOrigin)) {
      throw new ForbiddenException("Widget origin is not allowed for this tenant");
    }
  }

  recordPublicWidgetAsk(tenant: TenantSnapshot, metadata: Record<string, unknown> = {}): Promise<void> {
    return this.tenants.recordUsage(tenant.id, "public-widget.ask", metadata);
  }

  async verifyWidgetInstall(tenant: TenantSnapshot, url: string): Promise<TenantWidgetInstallCheckResponse> {
    const checkedAt = new Date().toISOString();
    const parsedUrl = new URL(url);
    const normalizedUrl = parsedUrl.toString();
    const origin = parsedUrl.origin.toLowerCase();
    const allowedOrigin = !tenant.widget.allowedOrigins.length || tenant.widget.allowedOrigins.includes(origin);

    if (!allowedOrigin) {
      return buildWidgetInstallCheckResponse({
        allowedOrigin,
        checkedAt,
        expectedTenantSlug: tenant.slug,
        origin,
        status: "blocked-origin",
        url: normalizedUrl
      });
    }

    try {
      const response = await fetch(normalizedUrl, {
        headers: {
          accept: "text/html"
        }
      });

      if (!response.ok) {
        return buildWidgetInstallCheckResponse({
          allowedOrigin,
          checkedAt,
          expectedTenantSlug: tenant.slug,
          origin,
          pageStatus: response.status,
          status: "unreachable",
          url: normalizedUrl
        });
      }

      const html = await response.text();
      const detectedTenantSlug = detectWidgetTenantSlug(html);
      const hasWidgetScript = hasPropertyFlowWidgetScript(html);

      if (!hasWidgetScript) {
        return buildWidgetInstallCheckResponse({
          allowedOrigin,
          checkedAt,
          expectedTenantSlug: tenant.slug,
          origin,
          status: "missing-widget",
          url: normalizedUrl
        });
      }

      if (detectedTenantSlug && detectedTenantSlug !== tenant.slug) {
        return buildWidgetInstallCheckResponse({
          allowedOrigin,
          checkedAt,
          detectedTenantSlug,
          expectedTenantSlug: tenant.slug,
          origin,
          status: "wrong-tenant",
          url: normalizedUrl
        });
      }

      return buildWidgetInstallCheckResponse({
        allowedOrigin,
        checkedAt,
        detectedTenantSlug,
        expectedTenantSlug: tenant.slug,
        origin,
        status: "verified",
        url: normalizedUrl
      });
    } catch (_error) {
      return buildWidgetInstallCheckResponse({
        allowedOrigin,
        checkedAt,
        expectedTenantSlug: tenant.slug,
        origin,
        status: "unreachable",
        url: normalizedUrl
      });
    }
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

function hasPropertyFlowWidgetScript(html: string) {
  return /<script\b[^>]*\bsrc=["'][^"']*(?:propertyflow\.ai\/widget\.js|\/widget\.js)[^"']*["'][^>]*>/i.test(html);
}

function detectWidgetTenantSlug(html: string) {
  const match = html.match(/\bdata-tenant=["']([^"']+)["']/i);

  return match?.[1];
}

function buildPublicWidgetReadiness(tenant: TenantSnapshot): PublicWidgetReadiness {
  const enabledLanguages = tenant.widget.languages;
  const hasLocalizedWelcome = enabledLanguages.every((language) =>
    Boolean(tenant.widget.welcomeMessages[language]?.trim())
  );
  const checks: PublicWidgetReadinessCheck[] = [
    {
      key: "origin-policy",
      label: "Origin policy",
      note: tenant.widget.allowedOrigins.length
        ? "Website origins are explicitly allowed for production installs."
        : "No origin allowlist is configured yet, so the widget is still in test mode.",
      ready: tenant.widget.allowedOrigins.length > 0
    },
    {
      key: "languages",
      label: "Languages",
      note: enabledLanguages.length
        ? `${enabledLanguages.length} locale${enabledLanguages.length === 1 ? "" : "s"} enabled for the launcher.`
        : "Enable at least one supported widget language.",
      ready: enabledLanguages.length > 0
    },
    {
      key: "localized-welcome",
      label: "Localized welcome",
      note: hasLocalizedWelcome
        ? "Every enabled language has a welcome message."
        : "Add a welcome message for every enabled language.",
      ready: enabledLanguages.length > 0 && hasLocalizedWelcome
    }
  ];
  const status: PublicWidgetReadiness["status"] = checks.some((check) => check.key !== "origin-policy" && !check.ready)
    ? "needs-setup"
    : checks.every((check) => check.ready)
      ? "ready"
      : "test-mode";
  const nextActions: Record<PublicWidgetReadiness["status"], string> = {
    "needs-setup": "Finish language and localized welcome settings before installing the widget.",
    ready: "Widget configuration is ready for production installation.",
    "test-mode": "Add production website origins before sharing the widget with live visitors."
  };

  return {
    checks,
    nextAction: nextActions[status],
    status
  };
}

function buildPublicWidgetCapabilities(tenant: TenantSnapshot): PublicWidgetConfigResponse["capabilities"] {
  return {
    knowledgeAnswers: true,
    leadCapture: tenant.subscriptionPlan === "growth" || tenant.subscriptionPlan === "enterprise",
    propertySearch: true
  };
}

function buildWidgetInstallCheckResponse(input: {
  allowedOrigin: boolean;
  checkedAt: string;
  detectedTenantSlug?: string;
  expectedTenantSlug: string;
  origin: string;
  pageStatus?: number;
  status: TenantWidgetInstallCheckResponse["status"];
  url: string;
}): TenantWidgetInstallCheckResponse {
  const messages: Record<TenantWidgetInstallCheckResponse["status"], string> = {
    "blocked-origin": `Add ${input.origin} to allowed website origins before using this widget there.`,
    "missing-widget": "PropertyFlow widget script was not found on this page.",
    unreachable: input.pageStatus
      ? `The page responded with HTTP ${input.pageStatus}. Check that the URL is public and reachable.`
      : "Could not reach this page. Check the URL or try again after the site is deployed.",
    verified: "Widget script is installed and points to this agency workspace.",
    "wrong-tenant": `Widget is installed, but it points to ${input.detectedTenantSlug} instead of ${input.expectedTenantSlug}.`
  };
  const nextActions: Record<TenantWidgetInstallCheckResponse["status"], string> = {
    "blocked-origin": "Add this origin in Widget website origins, then run the check again.",
    "missing-widget": "Paste the widget snippet before the closing body tag or into the agency tag manager.",
    unreachable: "Use a public page URL that returns HTML, then run the check again.",
    verified: "Open the page and confirm the launcher appears in each enabled language.",
    "wrong-tenant": "Replace the snippet with the current workspace snippet from this settings page."
  };

  return {
    allowedOrigin: input.allowedOrigin,
    checkedAt: input.checkedAt,
    checks: buildWidgetInstallChecks(input),
    detectedTenantSlug: input.detectedTenantSlug,
    expectedTenantSlug: input.expectedTenantSlug,
    message: messages[input.status],
    nextAction: nextActions[input.status],
    origin: input.origin,
    status: input.status,
    url: input.url
  };
}

function buildWidgetInstallChecks(input: {
  allowedOrigin: boolean;
  detectedTenantSlug?: string;
  expectedTenantSlug: string;
  status: TenantWidgetInstallCheckResponse["status"];
}): TenantWidgetInstallCheckItem[] {
  return [
    {
      key: "origin",
      label: "Origin allowlist",
      note: input.allowedOrigin ? "This website origin can use the widget." : "This website origin is not allowed yet.",
      status: input.allowedOrigin ? "passed" : "failed"
    },
    {
      key: "page",
      label: "Page reachable",
      note: input.status === "unreachable" ? "The install check could not read a public HTML page." : "The page can be checked.",
      status: input.status === "blocked-origin" ? "warning" : input.status === "unreachable" ? "failed" : "passed"
    },
    {
      key: "script",
      label: "Widget script",
      note: input.status === "missing-widget" ? "No PropertyFlow widget script was found." : "Widget script is present.",
      status:
        input.status === "blocked-origin" || input.status === "unreachable"
          ? "warning"
          : input.status === "missing-widget"
            ? "failed"
            : "passed"
    },
    {
      key: "tenant",
      label: "Tenant key",
      note:
        input.status === "wrong-tenant"
          ? `Detected ${input.detectedTenantSlug}; expected ${input.expectedTenantSlug}.`
          : `Expected tenant ${input.expectedTenantSlug}.`,
      status:
        input.status === "blocked-origin" || input.status === "unreachable" || input.status === "missing-widget"
          ? "warning"
          : input.status === "wrong-tenant"
            ? "failed"
            : "passed"
    }
  ];
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
  const allowedOrigins = normalizeAllowedOrigins(request.widget?.allowedOrigins);

  return {
    ...request,
    widget: request.widget
      ? {
          ...request.widget,
          aiName: request.widget.aiName?.trim() || undefined,
          aiNames,
          allowedOrigins,
          languages: languages?.length ? languages : undefined,
          personaGenders,
          tone: normalizeWidgetTone(request.widget.tone),
          welcomeMessage: request.widget.welcomeMessage?.trim() || welcomeMessages?.en || undefined,
          welcomeMessages
        }
      : undefined
  };
}

function normalizeAllowedOrigins(origins: string[] | undefined) {
  if (!origins) {
    return undefined;
  }

  return origins
    .map((origin) => normalizeRequestOrigin(origin))
    .filter((origin, index, values): origin is string => Boolean(origin) && values.indexOf(origin) === index);
}

function normalizeRequestOrigin(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.origin.toLowerCase();
  } catch (_error) {
    return undefined;
  }
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
