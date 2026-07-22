import type { TenantSnapshot } from "@propertyflow/contracts";
import { getTenantWidgetSettings } from "@entities/tenant/model/widget-settings";

export interface WidgetInstallConfig {
  apiBaseUrl?: string;
  aiName: string;
  aiNames: Record<string, string | undefined>;
  allowedOrigins: string[];
  languageCodes: string[];
  mode: "starter" | "growth" | "enterprise";
  personaGenders: Record<string, string | undefined>;
  tenantSlug: string;
  tone: string;
  welcomeMessage: string;
  welcomeMessages: Record<string, string | undefined>;
}

export interface WidgetInstallStep {
  done: boolean;
  label: string;
  note: string;
}

export interface WidgetLocaleIntegrationOption {
  label: string;
  note: string;
  value: string;
}

export interface WidgetInstallPackage {
  config: WidgetInstallConfig;
  dataAttributes: Array<{ label: string; value: string }>;
  localeOptions: WidgetLocaleIntegrationOption[];
  snippet: string;
  steps: WidgetInstallStep[];
}

export function buildWidgetInstallPackage(tenant: TenantSnapshot): WidgetInstallPackage {
  const widget = getTenantWidgetSettings(tenant);
  const config: WidgetInstallConfig = {
    aiName: widget.aiName,
    aiNames: widget.aiNames,
    allowedOrigins: widget.allowedOrigins,
    languageCodes: widget.languages,
    mode: tenant.subscriptionPlan,
    personaGenders: widget.personaGenders,
    tenantSlug: tenant.slug,
    tone: widget.tone,
    welcomeMessage: widget.welcomeMessage,
    welcomeMessages: widget.welcomeMessages
  };

  return {
    config,
    dataAttributes: [
      { label: "Tenant", value: config.tenantSlug },
      { label: "Mode", value: config.mode },
      { label: "AI name", value: config.aiName },
      { label: "Allowed origins", value: config.allowedOrigins.length ? String(config.allowedOrigins.length) : "Open while testing" },
      { label: "Languages", value: config.languageCodes.join(", ") },
      { label: "Tone", value: config.tone }
    ],
    localeOptions: buildWidgetLocaleOptions(config),
    snippet: buildWidgetSnippet(config),
    steps: buildWidgetInstallSteps(tenant)
  };
}

export function buildWidgetSnippet(config: WidgetInstallConfig): string {
  return `<script src="https://cdn.propertyflow.ai/widget.js" data-api-base="${escapeAttribute(config.apiBaseUrl ?? "https://api.propertyflow.ai")}" data-tenant="${escapeAttribute(config.tenantSlug)}" data-mode="${escapeAttribute(config.mode)}" data-locale="auto" data-ai-name="${escapeAttribute(config.aiName)}" data-ai-names="${escapeAttribute(JSON.stringify(config.aiNames))}" data-persona-genders="${escapeAttribute(JSON.stringify(config.personaGenders))}" data-tone="${escapeAttribute(config.tone)}" data-welcome-message="${escapeAttribute(config.welcomeMessage)}" data-welcome-messages="${escapeAttribute(JSON.stringify(config.welcomeMessages))}" data-languages="${escapeAttribute(config.languageCodes.join(","))}"></script>`;
}

function buildWidgetInstallSteps(tenant: TenantSnapshot): WidgetInstallStep[] {
  const widget = getTenantWidgetSettings(tenant);

  return [
    {
      done: Boolean(tenant.slug),
      label: "Tenant key",
      note: tenant.slug ? `Widget will attach to ${tenant.slug}.` : "Workspace slug is required before install."
    },
    {
      done: Boolean(tenant.branding.displayName),
      label: "Branding",
      note: tenant.branding.displayName
        ? `${tenant.branding.displayName} will be shown in the launcher context.`
        : "Set display name before sharing the snippet."
    },
    {
      done: tenant.subscriptionPlan === "starter" || tenant.subscriptionPlan === "growth" || tenant.subscriptionPlan === "enterprise",
      label: "Plan mode",
      note: `${tenant.subscriptionPlan} mode controls whether conversations stay as AI answers or create CRM leads.`
    },
    {
      done: widget.allowedOrigins.length > 0,
      label: "Website origins",
      note: widget.allowedOrigins.length
        ? "Widget requests are limited to configured agency website origins."
        : "Add production origins before sharing the snippet publicly."
    }
  ];
}

function buildWidgetLocaleOptions(config: WidgetInstallConfig): WidgetLocaleIntegrationOption[] {
  const primaryLanguage = config.languageCodes[0]?.toLowerCase() ?? "en";
  const enabledLanguages = config.languageCodes.length
    ? config.languageCodes.map((language) => language.toUpperCase()).join(", ")
    : "EN";

  return [
    {
      label: "Auto locale",
      value: 'data-locale="auto"',
      note: `Reads the page language and uses ${primaryLanguage.toUpperCase()} as the fallback. Enabled: ${enabledLanguages}.`
    },
    {
      label: "Fixed locale",
      value: `data-locale="${primaryLanguage}"`,
      note: "Use this on a localized page, or update the attribute from the agency site language switcher."
    }
  ];
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
