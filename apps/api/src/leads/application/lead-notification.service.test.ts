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

  it("sends Telegram messages with the tenant bot token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const service = new LeadNotificationService(
      tenantService(tenant({ leadTelegramBotToken: "telegram-test-token", leadTelegramChatIds: ["-100123"] }))
    );

    await service.notifyLeadCreated("tenant-demo", lead());

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-test-token/sendMessage",
      expect.objectContaining({
        body: expect.stringContaining('"chat_id":"-100123"')
      })
    );
  });

  it("sends compact concierge handoff details to Telegram", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("AGENCY_APP_BASE_URL", "https://agency.propertyflow.test/app/");
    const service = new LeadNotificationService(
      tenantService(tenant({ leadTelegramBotToken: "telegram-test-token", leadTelegramChatIds: ["-100123"] }))
    );

    await service.notifyLeadCreated(
      "tenant-demo",
      lead({
        contactEmail: undefined,
        contactName: "Website visitor",
        contactPhone: "+660827955673",
        message: [
          "Widget handoff request.",
          "",
          "Visitor note: i would like to see it next week, my phone number +660827955673",
          "",
          "Recommended listings:",
          "1. Price Comparable A (property-1)",
          "2. Pricing Metadata Smoke Condo (property-2)",
          "",
          "Recent widget conversation:",
          "assistant: Hi! I'm Anna, your AI property consultant.",
          "user: find me a condo in pattaya under 3m",
          "assistant: I found 6 matching listings for you and here is a deliberately long response that should not dominate messenger notifications.",
          "Shown listings:",
          "1. Price Comparable A (property-1)",
          "2. Pricing Metadata Smoke Condo (property-2)",
          "user: i like the first option, may i see it?",
          "user: i would like to see it next week, my phone number +660827955673"
        ].join("\n"),
        propertyId: "property-1"
      })
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { text: string };

    expect(requestBody.text).toContain("Request: i would like to see it next week");
    expect(requestBody.text).toContain("Selected listing: Price Comparable A (property-1)");
    expect(requestBody.text).toContain("Lead: https://agency.propertyflow.test/app/leads/lead-1");
    expect(requestBody.text).toContain("Listing: https://agency.propertyflow.test/app/listings/property-1");
    expect(requestBody.text).toContain("- i like the first option, may i see it?");
    expect(requestBody.text).not.toContain("Recent widget conversation:");
    expect(requestBody.text).not.toContain("deliberately long response");
  });

  it("sends LINE push messages with the tenant channel token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const service = new LeadNotificationService(
      tenantService(tenant({ leadLineChannelAccessToken: "line-test-token", leadLineRecipientIds: ["U123"] }))
    );

    await service.notifyLeadCreated("tenant-demo", lead());

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/push",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer line-test-token"
        }),
        body: expect.stringContaining('"to":"U123"')
      })
    );
  });

  it("sends WhatsApp text messages with the tenant Cloud API credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const service = new LeadNotificationService(
      tenantService(
        tenant({
          leadWhatsappAccessToken: "whatsapp-test-token",
          leadWhatsappPhoneNumberId: "phone-number-1",
          leadWhatsappRecipients: ["+66812345678"]
        })
      )
    );

    await service.notifyLeadCreated("tenant-demo", lead());

    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v20.0/phone-number-1/messages",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer whatsapp-test-token"
        }),
        body: expect.stringContaining('"messaging_product":"whatsapp"')
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
      leadLineChannelAccessToken: undefined,
      leadLineRecipientIds: [],
      leadTelegramBotToken: undefined,
      leadTelegramChatIds: [],
      leadWhatsappAccessToken: undefined,
      leadWhatsappGraphApiVersion: "v20.0",
      leadWhatsappPhoneNumberId: undefined,
      leadWhatsappRecipients: [],
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

function lead(overrides: Partial<LeadSnapshot> = {}): LeadSnapshot {
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
    updatedAt: "2026-08-06T08:05:00.000Z",
    ...overrides
  };
}
