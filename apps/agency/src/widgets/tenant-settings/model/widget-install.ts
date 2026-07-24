import type { PublicWidgetCapabilities, PublicWidgetReadiness, PublicWidgetReadinessCheck, TenantSnapshot } from "@propertyflow/contracts";
import { getTenantWidgetSettings } from "@entities/tenant/model/widget-settings";

export interface WidgetInstallConfig {
  apiBaseUrl?: string;
  aiName: string;
  aiNames: Record<string, string | undefined>;
  allowedOrigins: string[];
  capabilities: PublicWidgetCapabilities;
  languageCodes: string[];
  mode: "starter" | "growth" | "enterprise";
  personaGenders: Record<string, string | undefined>;
  tenantSlug: string;
  tone: string;
  welcomeMessage: string;
  welcomeMessages: Record<string, string | undefined>;
}

export interface WidgetInstallStep {
  actionHref?: string;
  actionLabel?: string;
  done: boolean;
  label: string;
  note: string;
}

export interface WidgetLocaleIntegrationOption {
  label: string;
  note: string;
  snippet: string;
  value: string;
}

export interface WidgetCapabilityItem {
  enabled: boolean;
  label: string;
  note: string;
}

export interface WidgetInstallPackage {
  capabilities: WidgetCapabilityItem[];
  config: WidgetInstallConfig;
  dataAttributes: Array<{ label: string; value: string }>;
  localeOptions: WidgetLocaleIntegrationOption[];
  readiness: PublicWidgetReadiness;
  snippet: string;
  steps: WidgetInstallStep[];
}

export interface WidgetLaunchReadinessInput {
  hasActiveKnowledgeJobs: boolean;
  hasLaunchReadyKnowledge: boolean;
  hasTenantSlug: boolean;
  runtimeReadiness: PublicWidgetReadiness;
}

export interface WidgetLaunchReadinessItemsInput extends WidgetLaunchReadinessInput {
  starterSourceTypesReady: number;
  tenantSlug?: string;
}

export interface WidgetLaunchReadinessSummary {
  completed: number;
  total: number;
}

export function buildWidgetInstallPackage(tenant: TenantSnapshot): WidgetInstallPackage {
  const widget = getTenantWidgetSettings(tenant);
  const capabilities = buildWidgetCapabilities(tenant);
  const config: WidgetInstallConfig = {
    aiName: widget.aiName,
    aiNames: widget.aiNames,
    allowedOrigins: widget.allowedOrigins,
    capabilities,
    languageCodes: widget.languages,
    mode: tenant.subscriptionPlan,
    personaGenders: widget.personaGenders,
    tenantSlug: tenant.slug,
    tone: widget.tone,
    welcomeMessage: widget.welcomeMessage,
    welcomeMessages: widget.welcomeMessages
  };

  return {
    capabilities: buildWidgetCapabilityItems(capabilities),
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
    readiness: buildWidgetRuntimeReadiness(config),
    snippet: buildWidgetSnippet(config),
    steps: buildWidgetInstallSteps(tenant)
  };
}

export function summarizeWidgetLaunchReadiness(input: WidgetLaunchReadinessInput): WidgetLaunchReadinessSummary {
  const extraChecks = [input.hasLaunchReadyKnowledge, input.hasLaunchReadyKnowledge && !input.hasActiveKnowledgeJobs, input.hasTenantSlug];

  return {
    completed: input.runtimeReadiness.checks.filter((check) => check.ready).length + extraChecks.filter(Boolean).length,
    total: input.runtimeReadiness.checks.length + extraChecks.length
  };
}

export function buildWidgetLaunchReadinessItems(input: WidgetLaunchReadinessItemsInput): WidgetInstallStep[] {
  return [
    ...input.runtimeReadiness.checks.map((check) => ({
      actionHref: getRuntimeReadinessAction(check.key)?.actionHref,
      actionLabel: getRuntimeReadinessAction(check.key)?.actionLabel,
      done: check.ready,
      label: check.label,
      note: check.note
    })),
    {
      actionHref: "/knowledge?create=source#create-knowledge-document",
      actionLabel: "Add knowledge",
      done: input.hasLaunchReadyKnowledge,
      label: "Knowledge available",
      note: input.hasLaunchReadyKnowledge
        ? `${input.starterSourceTypesReady} starter source types have AI-ready documents.`
        : "Add enough AI-ready Starter sources before installing the widget."
    },
    {
      actionHref: "/knowledge#knowledge-jobs",
      actionLabel: "View jobs",
      done: input.hasLaunchReadyKnowledge && !input.hasActiveKnowledgeJobs,
      label: "Indexing settled",
      note: input.hasActiveKnowledgeJobs ? "Wait for active ingestion jobs to finish." : "No active knowledge jobs are blocking widget copy."
    },
    {
      done: input.hasTenantSlug,
      label: "Tenant key ready",
      note: input.tenantSlug ? `Widget attaches to ${input.tenantSlug}.` : "Workspace slug is required for widget install."
    }
  ];
}

export function summarizeWidgetInstallSteps(steps: WidgetInstallStep[]): WidgetLaunchReadinessSummary {
  return {
    completed: steps.filter((step) => step.done).length,
    total: steps.length
  };
}

export function buildWidgetSnippet(config: WidgetInstallConfig, options: { locale?: string } = {}): string {
  const locale = options.locale ?? "auto";

  return `<script src="https://cdn.propertyflow.ai/widget.js" data-api-base="${escapeAttribute(config.apiBaseUrl ?? "https://api.propertyflow.ai")}" data-tenant="${escapeAttribute(config.tenantSlug)}" data-mode="${escapeAttribute(config.mode)}" data-locale="${escapeAttribute(locale)}" data-ai-name="${escapeAttribute(config.aiName)}" data-ai-names="${escapeAttribute(JSON.stringify(config.aiNames))}" data-persona-genders="${escapeAttribute(JSON.stringify(config.personaGenders))}" data-tone="${escapeAttribute(config.tone)}" data-welcome-message="${escapeAttribute(config.welcomeMessage)}" data-welcome-messages="${escapeAttribute(JSON.stringify(config.welcomeMessages))}" data-languages="${escapeAttribute(config.languageCodes.join(","))}"></script>`;
}

export function buildWidgetCapabilities(tenant: TenantSnapshot): PublicWidgetCapabilities {
  return {
    knowledgeAnswers: true,
    leadCapture: tenant.subscriptionPlan === "growth" || tenant.subscriptionPlan === "enterprise",
    propertySearch: true
  };
}

export function buildWidgetCapabilityItems(capabilities: PublicWidgetCapabilities): WidgetCapabilityItem[] {
  return [
    {
      enabled: capabilities.knowledgeAnswers,
      label: "Knowledge answers",
      note: "Concierge answers from agency documents and approved knowledge sources."
    },
    {
      enabled: capabilities.propertySearch,
      label: "Property search",
      note: "Imported listings feed Concierge search without forcing CRM adoption."
    },
    {
      enabled: capabilities.leadCapture,
      label: "CRM lead capture",
      note: capabilities.leadCapture
        ? "Growth and Enterprise handoff can create CRM leads."
        : "Starter keeps visitor conversations as AI answers until Growth is enabled."
    }
  ];
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
      actionHref: "#widget-origin-settings",
      actionLabel: "Add origins",
      done: widget.allowedOrigins.length > 0,
      label: "Website origins",
      note: widget.allowedOrigins.length
        ? "Widget requests are limited to configured agency website origins."
        : "Add production origins before sharing the snippet publicly."
    }
  ];
}

function getRuntimeReadinessAction(key: PublicWidgetReadinessCheck["key"]): Pick<WidgetInstallStep, "actionHref" | "actionLabel"> | undefined {
  const actions: Record<string, Pick<WidgetInstallStep, "actionHref" | "actionLabel">> = {
    languages: {
      actionHref: "#concierge-personality-settings",
      actionLabel: "Edit languages"
    },
    "localized-welcome": {
      actionHref: "#concierge-personality-settings",
      actionLabel: "Edit welcome"
    },
    "origin-policy": {
      actionHref: "#widget-origin-settings",
      actionLabel: "Add origins"
    }
  };

  return actions[key];
}

function buildWidgetLocaleOptions(config: WidgetInstallConfig): WidgetLocaleIntegrationOption[] {
  const primaryLanguage = config.languageCodes[0]?.toLowerCase() ?? "en";
  const enabledLanguages = config.languageCodes.length
    ? config.languageCodes.map((language) => language.toUpperCase()).join(", ")
    : "EN";
  const languages = config.languageCodes.length ? config.languageCodes : [primaryLanguage];

  return [
    {
      label: "Auto locale",
      value: 'data-locale="auto"',
      snippet: buildWidgetSnippet(config),
      note: `Reads the page language and uses ${primaryLanguage.toUpperCase()} as the fallback. Enabled: ${enabledLanguages}.`
    },
    ...languages.map((language) => ({
      label: `${language.toUpperCase()} page`,
      value: `data-locale="${language}"`,
      snippet: buildWidgetSnippet(config, { locale: language }),
      note: "Use this on a dedicated localized page, or set the same locale from the agency site language switcher."
    }))
  ];
}

export function buildWidgetRuntimeReadiness(config: WidgetInstallConfig): PublicWidgetReadiness {
  const hasLocalizedWelcome = config.languageCodes.every((language) => Boolean(config.welcomeMessages[language]?.trim()));
  const checks: PublicWidgetReadinessCheck[] = [
    {
      key: "origin-policy",
      label: "Origin policy",
      note: config.allowedOrigins.length
        ? "Website origins are explicitly allowed for production installs."
        : "No origin allowlist is configured yet, so the widget is still in test mode.",
      ready: config.allowedOrigins.length > 0
    },
    {
      key: "languages",
      label: "Languages",
      note: config.languageCodes.length
        ? `${config.languageCodes.length} locale${config.languageCodes.length === 1 ? "" : "s"} enabled for the launcher.`
        : "Enable at least one supported widget language.",
      ready: config.languageCodes.length > 0
    },
    {
      key: "localized-welcome",
      label: "Localized welcome",
      note: hasLocalizedWelcome
        ? "Every enabled language has a welcome message."
        : "Add a welcome message for every enabled language.",
      ready: config.languageCodes.length > 0 && hasLocalizedWelcome
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

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
