import type { TenantSnapshot } from "@propertyflow/contracts";

export interface WidgetInstallConfig {
  aiName: string;
  languageCodes: string[];
  mode: "starter" | "growth" | "enterprise";
  tenantSlug: string;
  welcomeMessage: string;
}

export interface WidgetInstallStep {
  done: boolean;
  label: string;
  note: string;
}

export interface WidgetInstallPackage {
  config: WidgetInstallConfig;
  dataAttributes: Array<{ label: string; value: string }>;
  snippet: string;
  steps: WidgetInstallStep[];
}

const defaultLanguageCodes = ["en", "ru", "th", "zh"];

export function buildWidgetInstallPackage(tenant: TenantSnapshot): WidgetInstallPackage {
  const config: WidgetInstallConfig = {
    aiName: "Anna",
    languageCodes: defaultLanguageCodes,
    mode: tenant.subscriptionPlan,
    tenantSlug: tenant.slug,
    welcomeMessage: "Hi! I'm Anna, your AI property consultant."
  };

  return {
    config,
    dataAttributes: [
      { label: "Tenant", value: config.tenantSlug },
      { label: "Mode", value: config.mode },
      { label: "AI name", value: config.aiName },
      { label: "Languages", value: config.languageCodes.join(", ") }
    ],
    snippet: buildWidgetSnippet(config),
    steps: buildWidgetInstallSteps(tenant)
  };
}

export function buildWidgetSnippet(config: WidgetInstallConfig): string {
  return `<script src="https://cdn.propertyflow.ai/widget.js" data-tenant="${escapeAttribute(config.tenantSlug)}" data-mode="${escapeAttribute(config.mode)}" data-ai-name="${escapeAttribute(config.aiName)}" data-welcome-message="${escapeAttribute(config.welcomeMessage)}" data-languages="${escapeAttribute(config.languageCodes.join(","))}"></script>`;
}

function buildWidgetInstallSteps(tenant: TenantSnapshot): WidgetInstallStep[] {
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
