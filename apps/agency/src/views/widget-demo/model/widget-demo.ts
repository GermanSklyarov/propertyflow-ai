import type { TenantSnapshot, TenantWidgetLanguage } from "@propertyflow/contracts";
import { getTenantWidgetSettings, supportedTenantWidgetLanguageOptions } from "@entities/tenant/model/widget-settings";
import { getDefaultConciergeAnswerCheckMessage } from "@widgets/tenant-settings/model/concierge-answer-check";

export interface WidgetDemoPrompt {
  label: string;
  locale: TenantWidgetLanguage;
  message: string;
}

export interface WidgetDemoProfile {
  aiName: string;
  locale: TenantWidgetLanguage;
  localeLabel: string;
  welcomeMessage: string;
}

export interface WidgetDemoSummary {
  originMode: "restricted" | "test";
  originNote: string;
  tenantSlug: string;
}

export function buildWidgetDemoProfiles(tenant: TenantSnapshot): WidgetDemoProfile[] {
  const widget = getTenantWidgetSettings(tenant);

  return widget.languages.map((locale) => ({
    aiName: widget.aiNames[locale] ?? widget.aiName,
    locale,
    localeLabel: getWidgetLocaleLabel(locale),
    welcomeMessage: widget.welcomeMessages[locale] ?? widget.welcomeMessage
  }));
}

export function buildWidgetDemoPrompts(tenant: TenantSnapshot): WidgetDemoPrompt[] {
  const widget = getTenantWidgetSettings(tenant);

  return widget.languages.map((locale) => ({
    label: getWidgetLocaleLabel(locale),
    locale,
    message: getDefaultConciergeAnswerCheckMessage(locale)
  }));
}

export function buildWidgetDemoSummary(tenant: TenantSnapshot): WidgetDemoSummary {
  const widget = getTenantWidgetSettings(tenant);
  const hasOrigins = widget.allowedOrigins.length > 0;

  return {
    originMode: hasOrigins ? "restricted" : "test",
    originNote: hasOrigins
      ? `${widget.allowedOrigins.length} allowed origin${widget.allowedOrigins.length === 1 ? "" : "s"} configured.`
      : "No production origin is required for this internal demo host.",
    tenantSlug: tenant.slug
  };
}

export function getPrimaryWidgetDemoProfile(tenant: TenantSnapshot): WidgetDemoProfile {
  return buildWidgetDemoProfiles(tenant)[0] ?? {
    aiName: "Anna",
    locale: "en",
    localeLabel: "English",
    welcomeMessage: "Hi! I'm Anna, your AI property consultant."
  };
}

function getWidgetLocaleLabel(locale: TenantWidgetLanguage) {
  return supportedTenantWidgetLanguageOptions.find((option) => option.value === locale)?.label ?? locale.toUpperCase();
}
