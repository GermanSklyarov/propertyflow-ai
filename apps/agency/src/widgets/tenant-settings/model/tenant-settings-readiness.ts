import type { TenantSnapshot, TenantUsageMetric, TenantUsageResponse } from "@propertyflow/contracts";
import { getTenantWidgetSettings } from "@entities/tenant/model/widget-settings";
import { formatNumber } from "@shared/lib/formatters";

export interface TenantSettingsReadinessItem {
  actionHref?: string;
  actionLabel?: string;
  done: boolean;
  label: string;
  note: string;
}

export interface TenantSettingsRoleScope {
  label: string;
  scope: string;
}

export interface TenantSettingsIntegrationStatus {
  label: string;
  status: string;
}

export function buildTenantSettingsReadinessItems(
  tenant: TenantSnapshot,
  usage: TenantUsageResponse
): TenantSettingsReadinessItem[] {
  const widget = getTenantWidgetSettings(tenant);
  const propertyUsage = getUsageMetric(usage.items, "properties");
  const agentUsage = getUsageMetric(usage.items, "agents");
  const apiUsage = getUsageMetric(usage.items, "publicApiRequestsMonthly");

  return [
    {
      done: Boolean(tenant.branding.displayName && tenant.branding.primaryColor),
      label: "Brand identity",
      note: tenant.branding.logoUrl ? "Display name, color, and logo are configured." : "Add a logo when the agency brand is ready."
    },
    {
      actionHref: "#widget-origin-settings",
      actionLabel: "Add origin",
      done: widget.allowedOrigins.length > 0,
      label: "Widget origin allowlist",
      note: widget.allowedOrigins.length
        ? `${widget.allowedOrigins.length} production origin${widget.allowedOrigins.length === 1 ? "" : "s"} configured.`
        : "Restrict the public widget to approved agency website origins."
    },
    {
      actionHref: "/knowledge#knowledge-sources",
      actionLabel: "Import listings",
      done: Boolean(propertyUsage && propertyUsage.used > 0 && propertyUsage.utilizationRate < 90),
      label: "Searchable listings",
      note: propertyUsage
        ? `${formatNumber(propertyUsage.used)} of ${formatNumber(propertyUsage.limit)} listings available for Concierge.`
        : "Listing usage is not available yet."
    },
    {
      actionHref: "#lead-qualification-settings",
      actionLabel: "Review fields",
      done: widget.leadQualificationFields.length > 0,
      label: "Lead qualification",
      note: `${widget.leadQualificationFields.length} follow-up field${widget.leadQualificationFields.length === 1 ? "" : "s"} enabled.`
    },
    {
      actionHref: "#lead-notification-settings",
      actionLabel: "Connect channel",
      done: hasLeadNotificationChannel(tenant),
      label: "Lead notifications",
      note: hasLeadNotificationChannel(tenant)
        ? "LINE, Telegram, email, webhook, or WhatsApp handoff is configured."
        : "Connect at least one notification channel before live traffic."
    },
    {
      done: Boolean(apiUsage && apiUsage.utilizationRate < 80),
      label: "Concierge API headroom",
      note: apiUsage
        ? `${formatNumber(apiUsage.remaining)} public Concierge calls remain this period.`
        : "Public API usage is not available yet."
    },
    {
      done: Boolean(agentUsage && agentUsage.used > 0 && agentUsage.utilizationRate < 95),
      label: "Lead owner seats",
      note: agentUsage
        ? `${formatNumber(agentUsage.used)} of ${formatNumber(agentUsage.limit)} agent seats available for handoff.`
        : "Agent seat usage is not available yet."
    }
  ];
}

export function buildTenantSettingsRoleScopes(plan: TenantSnapshot["subscriptionPlan"]): TenantSettingsRoleScope[] {
  if (plan === "starter") {
    return [];
  }

  return [
    { label: "Agent", scope: "Own leads, assigned listings, Concierge follow-up" },
    { label: "Broker", scope: "Team inventory, lead assignment, publishing controls" },
    { label: "Manager", scope: "Settings, analytics, AI tools, integrations" },
    { label: "Admin", scope: "Tenant administration and platform-level controls" }
  ];
}

export function buildTenantSettingsIntegrationStatuses(
  tenant: TenantSnapshot,
  usage: TenantUsageResponse
): TenantSettingsIntegrationStatus[] {
  const widget = getTenantWidgetSettings(tenant);
  const propertyUsage = getUsageMetric(usage.items, "properties");
  const apiUsage = getUsageMetric(usage.items, "publicApiRequestsMonthly");
  const notificationChannels = countLeadNotificationChannels(tenant);

  return [
    {
      label: "Widget origin allowlist",
      status: widget.allowedOrigins.length
        ? `${widget.allowedOrigins.length} allowed origin${widget.allowedOrigins.length === 1 ? "" : "s"}`
        : "needs production origin"
    },
    {
      label: "Concierge message API",
      status: apiUsage ? `${formatNumber(apiUsage.remaining)} calls remaining` : "usage unavailable"
    },
    {
      label: "Listing search",
      status: propertyUsage && propertyUsage.used > 0 ? `${formatNumber(propertyUsage.used)} listings available` : "needs listing import"
    },
    {
      label: "Qualified lead handoff",
      status: widget.leadQualificationFields.length
        ? `${widget.leadQualificationFields.length} fields enabled`
        : "needs qualification fields"
    },
    {
      label: "Lead notifications",
      status: notificationChannels ? `${notificationChannels} channel${notificationChannels === 1 ? "" : "s"} configured` : "needs LINE/Telegram/email"
    }
  ];
}

function hasLeadNotificationChannel(tenant: TenantSnapshot) {
  return countLeadNotificationChannels(tenant) > 0;
}

function countLeadNotificationChannels(tenant: TenantSnapshot) {
  const widget = getTenantWidgetSettings(tenant);

  return [
    (widget.leadNotificationEmails ?? []).length > 0,
    Boolean(widget.leadWebhookUrl),
    Boolean(widget.leadTelegramBotToken && (widget.leadTelegramChatIds ?? []).length > 0),
    Boolean(widget.leadLineChannelAccessToken && (widget.leadLineRecipientIds ?? []).length > 0),
    Boolean(widget.leadWhatsappAccessToken && widget.leadWhatsappPhoneNumberId && (widget.leadWhatsappRecipients ?? []).length > 0)
  ].filter(Boolean).length;
}

function getUsageMetric(items: TenantUsageMetric[], key: TenantUsageMetric["key"]) {
  return items.find((item) => item.key === key);
}
