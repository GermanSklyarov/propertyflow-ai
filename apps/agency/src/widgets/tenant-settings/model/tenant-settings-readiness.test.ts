import { describe, expect, it } from "vitest";
import type { TenantSnapshot, TenantUsageResponse } from "@propertyflow/contracts";
import { defaultTenantWidgetSettings } from "@entities/tenant/model/widget-settings";
import {
  buildTenantSettingsIntegrationStatuses,
  buildTenantSettingsReadinessItems,
  buildTenantSettingsRoleScopes
} from "./tenant-settings-readiness";

describe("tenant settings readiness model", () => {
  it("keeps Starter settings focused on real launch requirements", () => {
    const tenant = tenantFactory({
      widget: {
        ...defaultTenantWidgetSettings,
        allowedOrigins: [],
        leadLineChannelAccessToken: undefined,
        leadLineRecipientIds: [],
        leadTelegramBotToken: undefined,
        leadTelegramChatIds: []
      }
    });
    const usage = usageFactory({ aiListingsUsed: 0, propertiesUsed: 97 });

    const readiness = buildTenantSettingsReadinessItems(tenant, usage);
    const integrations = buildTenantSettingsIntegrationStatuses(tenant, usage);

    expect(buildTenantSettingsRoleScopes("starter")).toEqual([]);
    expect(readiness.map((item) => item.label)).toEqual([
      "Brand identity",
      "Widget origin allowlist",
      "Searchable listings",
      "Lead qualification",
      "Lead notifications",
      "Concierge API headroom",
      "Lead owner seats"
    ]);
    expect(readiness.find((item) => item.label === "Widget origin allowlist")).toMatchObject({
      actionHref: "#widget-origin-settings",
      done: false
    });
    expect(integrations.map((item) => item.label)).not.toContain("WebSocket realtime");
    expect(integrations).toContainEqual({
      label: "Listing search",
      status: "needs listing import"
    });
  });

  it("keeps CRM role matrix available outside Starter", () => {
    expect(buildTenantSettingsRoleScopes("growth").map((role) => role.label)).toEqual(["Agent", "Broker", "Manager", "Admin"]);
    expect(buildTenantSettingsRoleScopes("enterprise").map((role) => role.label)).toEqual(["Agent", "Broker", "Manager", "Admin"]);
  });

  it("summarizes configured Starter services from widget and usage data", () => {
    const tenant = tenantFactory({
      widget: {
        ...defaultTenantWidgetSettings,
        allowedOrigins: ["https://agency.example.com"],
        leadTelegramBotToken: "telegram-token",
        leadTelegramChatIds: ["-100123"]
      }
    });
    const usage = usageFactory({ aiListingsUsed: 61, propertiesUsed: 97, publicApiRemaining: 9200 });

    expect(buildTenantSettingsReadinessItems(tenant, usage)).toContainEqual(
      expect.objectContaining({
        done: true,
        label: "Lead notifications",
        note: "LINE, Telegram, email, webhook, or WhatsApp handoff is configured."
      })
    );
    expect(buildTenantSettingsIntegrationStatuses(tenant, usage)).toContainEqual({
      label: "Lead notifications",
      status: "1 channel configured"
    });
  });
});

function tenantFactory(overrides: Partial<TenantSnapshot> = {}): TenantSnapshot {
  return {
    branding: {
      displayName: "Pattaya Demo Realty",
      primaryColor: "#0f766e"
    },
    createdAt: "2026-07-20T00:00:00.000Z",
    domainStatus: "not-configured",
    id: "tenant-1",
    limits: {
      agents: 5,
      aiListings: 1000,
      aiCreditsMonthly: 5000,
      properties: 500,
      publicApiRequestsMonthly: 10000
    },
    name: "Pattaya Demo Realty",
    slug: "demo-agency",
    status: "active",
    subscriptionPlan: "starter",
    updatedAt: "2026-07-20T00:00:00.000Z",
    widget: defaultTenantWidgetSettings,
    ...overrides
  };
}

function usageFactory({
  aiListingsUsed = 12,
  propertiesUsed = 12,
  publicApiRemaining = 9900
}: {
  aiListingsUsed?: number;
  propertiesUsed?: number;
  publicApiRemaining?: number;
} = {}): TenantUsageResponse {
  return {
    generatedAt: "2026-08-10T00:00:00.000Z",
    items: [
      metric("aiListings", aiListingsUsed, 1000),
      metric("properties", propertiesUsed, 1000),
      metric("agents", 1, 1),
      metric("aiCreditsMonthly", 120, 5000),
      metric("publicApiRequestsMonthly", 10000 - publicApiRemaining, 10000)
    ],
    periodEnd: "2026-09-01T00:00:00.000Z",
    periodStart: "2026-08-01T00:00:00.000Z",
    subscriptionPlan: "starter",
    tenantId: "tenant-1"
  };
}

function metric(key: TenantUsageResponse["items"][number]["key"], used: number, limit: number) {
  return {
    key,
    limit,
    remaining: Math.max(0, limit - used),
    used,
    utilizationRate: limit > 0 ? (used / limit) * 100 : 0
  };
}
