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
    const tenants = tenantService(tenant({ leadTelegramBotToken: "telegram-test-token", leadTelegramChatIds: ["-100123"] }));
    const service = new LeadNotificationService(
      tenants
    );

    await service.notifyLeadCreated("tenant-demo", lead());

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-test-token/sendMessage",
      expect.objectContaining({
        body: expect.stringContaining('"chat_id":"-100123"')
      })
    );
    expect(tenants.recordUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      operation: "lead_notification_sent",
      quantity: 1,
      service: "telegram",
      tenantId: "tenant-demo"
    }));
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
          "Visitor note: my phone number +660827955673",
          "",
          "Lead qualification:",
          "Intent: Buy",
          "Budget: under 3m",
          "Purpose: Relocation",
          "Ownership/quota: Foreign quota",
          "Purchase timing: next year",
          "Viewing time: monday at 10 a.m.",
          "Preferred contact time: tomorrow morning",
          "Contact channel: Phone",
          "",
          "Recommended listings:",
          "1. Price Comparable A (property-1)",
          "2. Pricing Metadata Smoke Condo (property-2)",
          "3. Price Recommendation Target Condo (property-3)",
          "",
          "Recent widget conversation:",
          "assistant: I found 6 matching listings for you and here is a deliberately long response that should not dominate messenger notifications.",
          "Shown listings:",
          "1. Price Comparable A (property-1)",
          "2. Pricing Metadata Smoke Condo (property-2)",
          "3. Price Recommendation Target Condo (property-3)",
          "user: which one of them is closer to the beach?",
          "user: i like Price Recommendation Target Condo, may i see it?",
          "user: can i see it on monday at 10 a.m.?",
          "user: my phone number +660827955673"
        ].join("\n"),
        propertyId: "property-3"
      })
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { text: string };

    expect(requestBody.text).toContain("✨ New AI Concierge lead");
    expect(requestBody.text).toContain("📞 Phone: +660827955673");
    expect(requestBody.text).toContain("💬 Contact channel: Phone");
    expect(requestBody.text).toContain("🧭 Intent: Buy");
    expect(requestBody.text).toContain("💰 Budget: under 3m");
    expect(requestBody.text).toContain("🎯 Purpose: Relocation");
    expect(requestBody.text).toContain("🪪 Ownership/quota: Foreign quota");
    expect(requestBody.text).toContain("⏳ Purchase timing: next year");
    expect(requestBody.text).toContain("🗓️ Viewing time: monday at 10 a.m.");
    expect(requestBody.text).toContain("⏰ Preferred contact time: tomorrow morning");
    expect(requestBody.text).toContain("📝 Latest request: my phone number +660827955673");
    expect(requestBody.text).toContain("🏠 Selected listing: Price Recommendation Target Condo (property-3)");
    expect(requestBody.text).toContain("📋 Lead: https://agency.propertyflow.test/app/leads/lead-1");
    expect(requestBody.text).toContain("🔗 Listing: https://agency.propertyflow.test/app/listings/property-3");
    expect(requestBody.text).toContain("- i like Price Recommendation Target Condo, may i see it?");
    expect(requestBody.text).not.toContain("Recent widget conversation:");
    expect(requestBody.text).not.toContain("deliberately long response");
  });

  it("sends Telegram continuation viewing context with selected listing title", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const service = new LeadNotificationService(
      tenantService(tenant({ leadTelegramBotToken: "telegram-test-token", leadTelegramChatIds: ["-100123"] }))
    );

    await service.notifyLeadCreated(
      "tenant-demo",
      lead({
        contactEmail: undefined,
        contactName: "GermanSklyarov",
        contactPhone: "Telegram @GermanSklyarov",
        message: [
          "Widget handoff request.",
          "",
          "Visitor note: я бы хотел посмотреть в понедельник в 10 утра, мой ТГ @GermanSklyarov",
          "",
          "Lead qualification:",
          "Intent: Buy",
          "Purpose: Relocation",
          "Timing: я бы хотел посмотреть в понедельник в 10 утра, мой ТГ @GermanSklyarov",
          "Contact channel: Telegram",
          "",
          "Recommended listings:",
          "1. Wongamat Sea View Residence (property-1)",
          "",
          "Recent widget conversation:",
          "user: Хочу кондо в Паттайе с бассейном до 5 млн для релокации",
          "user: мне подходит, можно посмотреть?",
          "user: я бы хотел посмотреть в понедельник в 10 утра, мой ТГ @GermanSklyarov"
        ].join("\n"),
        preferredLocale: "ru",
        propertyId: "property-1"
      })
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { text: string };

    expect(requestBody.text).toContain("👤 Contact: GermanSklyarov");
    expect(requestBody.text).toContain("📞 Phone: Telegram @GermanSklyarov");
    expect(requestBody.text).toContain("💬 Contact channel: Telegram");
    expect(requestBody.text).toContain("🧭 Intent: Buy");
    expect(requestBody.text).toContain("🎯 Purpose: Relocation");
    expect(requestBody.text).toContain("🏠 Selected listing: Wongamat Sea View Residence (property-1)");
    expect(requestBody.text).toContain("📝 Latest request: я бы хотел посмотреть в понедельник в 10 утра");
    expect(requestBody.text).toContain("- мне подходит, можно посмотреть?");
    expect(requestBody.text).not.toContain("🏠 Property ID: property-1");
  });

  it("sends Russian rental qualification and selected listing details to Telegram", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const service = new LeadNotificationService(
      tenantService(tenant({ leadTelegramBotToken: "telegram-test-token", leadTelegramChatIds: ["-100123"] }))
    );

    await service.notifyLeadCreated(
      "tenant-demo",
      lead({
        contactName: "Website visitor",
        contactPhone: "Telegram @GermanSklyarov",
        message: [
          "Widget handoff request.",
          "",
          "Visitor note: я бы хотел посмотреть в понедельник в час дня, мой ТГ @GermanSklyarov",
          "",
          "Lead qualification:",
          "Intent: Rent",
          "Budget: до 20 тысяч",
          "Move-in: в конце ноября",
          "Contract length: полгода",
          "Viewing time: понедельник в час дня",
          "Contact channel: Telegram",
          "",
          "Recommended listings:",
          "1. 1BR Condo at The Ville Jomtien - East Pattaya (jomtien-1br)",
          "",
          "Recent widget conversation:",
          "user: меня интересует аренда, бюджет до 20 тысяч, планирую въехать в конце ноября, контракт на полгода",
          "user: может, на джомтьене есть?",
          "user: я бы хотел посмотреть в понедельник в час дня, мой ТГ @GermanSklyarov"
        ].join("\n"),
        preferredLocale: "ru",
        propertyId: "jomtien-1br"
      })
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { text: string };

    expect(requestBody.text).toContain("📞 Phone: Telegram @GermanSklyarov");
    expect(requestBody.text).toContain("💬 Contact channel: Telegram");
    expect(requestBody.text).toContain("🧭 Intent: Rent");
    expect(requestBody.text).toContain("💰 Budget: до 20 тысяч");
    expect(requestBody.text).toContain("📦 Move-in: в конце ноября");
    expect(requestBody.text).toContain("📄 Contract length: полгода");
    expect(requestBody.text).toContain("🗓️ Viewing time: понедельник в час дня");
    expect(requestBody.text).toContain("🏠 Selected listing: 1BR Condo at The Ville Jomtien - East Pattaya (jomtien-1br)");
    expect(requestBody.text).not.toContain("Siam Oriental");
  });

  it("uses the lead property id instead of the first recommended listing in Telegram summaries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const service = new LeadNotificationService(
      tenantService(tenant({ leadTelegramBotToken: "telegram-test-token", leadTelegramChatIds: ["-100123"] }))
    );

    await service.notifyLeadCreated(
      "tenant-demo",
      lead({
        contactName: "Website visitor",
        contactPhone: "Telegram @GermanSklyarov",
        message: [
          "Widget handoff request.",
          "",
          "Visitor note: я бы хотел посмотреть в понедельник в 10 утра, мой ТГ @GermanSklyarov",
          "",
          "Lead qualification:",
          "Intent: Buy",
          "Budget: до 5млн",
          "Purpose: Relocation",
          "Viewing time: понедельник в 10",
          "Contact channel: Telegram",
          "",
          "Recommended listings:",
          "1. Wongamat Sea View Residence (property-1)",
          "2. Pratumnak Investment One-Bed (property-4)",
          "",
          "Recent widget conversation:",
          "user: хочу купить кондо в паттайе с бассейном для релокации, бюджет до 5млн"
        ].join("\n"),
        preferredLocale: "ru",
        propertyId: "property-1"
      })
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { text: string };

    expect(requestBody.text).toContain("🏠 Selected listing: Wongamat Sea View Residence (property-1)");
    expect(requestBody.text).not.toContain("🏠 Selected listing: Pratumnak Investment One-Bed");
  });

  it("sends LINE push messages with the tenant channel token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const tenants = tenantService(tenant({ leadLineChannelAccessToken: "line-test-token", leadLineRecipientIds: ["U123"] }));
    const service = new LeadNotificationService(
      tenants
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
    expect(tenants.recordUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      operation: "lead_notification_sent",
      quantity: 1,
      service: "line",
      tenantId: "tenant-demo"
    }));
  });

  it("records failed messenger deliveries as usage events", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);
    const tenants = tenantService(tenant({ leadTelegramBotToken: "telegram-test-token", leadTelegramChatIds: ["-100123"] }));
    const service = new LeadNotificationService(tenants);

    await service.notifyLeadCreated("tenant-demo", lead());

    expect(tenants.recordUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      operation: "lead_notification_failed",
      quantity: 1,
      service: "telegram",
      tenantId: "tenant-demo"
    }));
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
    findActiveTenant: vi.fn().mockResolvedValue(snapshot),
    recordUsageEvent: vi.fn().mockResolvedValue(undefined)
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
      aiListings: 1000,
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
