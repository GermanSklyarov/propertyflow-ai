import { afterEach, describe, expect, it, vi } from "vitest";
import type { LeadSnapshot, TenantSnapshot } from "@propertyflow/contracts";
import type { TenantService } from "../../tenants/application/tenant.service.js";
import { LeadNotificationService } from "./lead-notification.service.js";

describe("LeadNotificationService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts configured tenant webhooks for new leads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const service = new LeadNotificationService(tenantService(tenant({ leadWebhookUrl: "https://hooks.example.com/leads" })));

    await service.notifyLeadCreated("tenant-demo", lead());

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.example.com/leads",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"event":"lead.created"')
      })
    );
  });

  it("sends email through Resend when recipients and provider env are configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("RESEND_API_KEY", "resend-test-key");
    vi.stubEnv("PROPERTYFLOW_EMAIL_FROM", "PropertyFlowAI <leads@propertyflow.ai>");
    const service = new LeadNotificationService(tenantService(tenant({ leadNotificationEmails: ["owner@example.com"] })));

    await service.notifyLeadCreated("tenant-demo", lead());

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer resend-test-key"
        }),
        body: expect.stringContaining("owner@example.com")
      })
    );
  });

  it("skips delivery when tenant notifications are disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const service = new LeadNotificationService(tenantService(tenant({ leadNotificationsEnabled: false })));

    await service.notifyLeadCreated("tenant-demo", lead());

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function tenantService(snapshot: TenantSnapshot): TenantService {
  return {
    findActiveTenant: vi.fn().mockResolvedValue(snapshot)
  } as unknown as TenantService;
}

function tenant(widgetOverrides: Partial<TenantSnapshot["widget"]> = {}): TenantSnapshot {
  return {
    branding: {
      displayName: "Demo Agency"
    },
    createdAt: "2026-08-06T08:00:00.000Z",
    domainStatus: "not-configured",
    id: "tenant-demo",
    limits: {
      agents: 1,
      aiCreditsMonthly: 5000,
      properties: 100,
      publicApiRequestsMonthly: 25000
    },
    name: "Demo Agency",
    slug: "demo-agency",
    status: "active",
    subscriptionPlan: "starter",
    updatedAt: "2026-08-06T08:00:00.000Z",
    widget: {
      aiName: "Anna",
      aiNames: { en: "Anna" },
      allowedOrigins: [],
      languages: ["en"],
      leadNotificationEmails: [],
      leadNotificationsEnabled: true,
      leadQualificationFields: ["budget", "email", "phone"],
      listingUrlTemplate: "/listings/:propertyId",
      personaGenders: { en: "feminine" },
      tone: "friendly",
      welcomeMessage: "Hi",
      welcomeMessages: { en: "Hi" },
      ...widgetOverrides
    }
  };
}

function lead(): LeadSnapshot {
  return {
    contactEmail: "client@example.com",
    contactName: "John Client",
    createdAt: "2026-08-06T08:05:00.000Z",
    id: "lead-1",
    message: "Budget: 5M THB",
    preferredLocale: "en",
    priority: "high",
    source: "ai-concierge",
    status: "new",
    tenantId: "tenant-demo",
    updatedAt: "2026-08-06T08:05:00.000Z"
  };
}
