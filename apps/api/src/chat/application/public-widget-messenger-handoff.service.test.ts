import { describe, expect, it, vi, afterEach } from "vitest";
import type { TenantSnapshot } from "@propertyflow/contracts";
import type { Pool } from "pg";
import type { LeadService } from "../../leads/application/lead.service.js";
import type { TenantService } from "../../tenants/application/tenant.service.js";
import type { AiChatService } from "./ai-chat.service.js";
import { PublicWidgetMessengerHandoffService } from "./public-widget-messenger-handoff.service.js";

describe("PublicWidgetMessengerHandoffService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a Telegram deep link without storing the raw transfer token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ ok: true, result: { username: "propertyflow_demo_bot" } }),
        ok: true
      })
    );
    const pool = poolMock();
    const service = new PublicWidgetMessengerHandoffService(pool, tenantService(), chatService());

    const response = await service.createHandoff(tenant(), {
      conversation: [{ role: "user", text: "Хочу кондо в Паттайе до 5 млн" }],
      locale: "ru",
      provider: "telegram",
      sessionId: "session-1"
    });

    expect(response.options).toHaveLength(1);
    expect(response.options[0]).toMatchObject({
      provider: "telegram",
      status: "available"
    });
    expect(response.options[0]?.url).toMatch(/^https:\/\/t\.me\/propertyflow_demo_bot\?start=pf_[A-Za-z0-9_-]+$/);
    const params = vi.mocked(pool.query).mock.calls[0]?.[1] as unknown[];
    expect(String(params[4])).toMatch(/^[a-f0-9]{64}$/);
    expect(response.options[0]?.url).not.toContain(String(params[4]));
  });

  it("does not create Telegram handoff links before the bot webhook is connected", async () => {
    const service = new PublicWidgetMessengerHandoffService(poolMock(), tenantService(), chatService());

    await expect(
      service.createHandoff(tenant({ leadTelegramWebhookSecret: undefined }), {
        conversation: [{ role: "user", text: "Хочу кондо в Паттайе до 5 млн" }],
        locale: "ru",
        provider: "telegram",
        sessionId: "session-1"
      })
    ).resolves.toMatchObject({
      options: [
        {
          provider: "telegram",
          reason: expect.stringContaining("webhook"),
          status: "missing-credentials"
        }
      ]
    });
  });

  it("links Telegram /start and continues the same localized concierge conversation", async () => {
    const pool = poolMock();
    const query = pool.query as unknown as ReturnType<typeof vi.fn>;
    query
      .mockResolvedValueOnce({
        rows: [
          {
            conversation: [
              { role: "user", text: "Хочу кондо в Паттайе с бассейном до 5 млн для релокации" },
              {
                recommendedListings: [
                  { propertyId: "property-1", title: "Wongamat Sea View Residence" },
                  { propertyId: "property-3", title: "Jomtien Family Corner Condo" },
                  { propertyId: "property-4", title: "Pratumnak Investment One-Bed" }
                ],
                role: "assistant",
                text: "Я нашла 3 подходящих варианта."
              }
            ],
            locale: "ru"
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            conversation: [
              { role: "user", text: "Хочу кондо в Паттайе с бассейном до 5 млн для релокации" },
              {
                recommendedListings: [
                  { propertyId: "property-1", title: "Wongamat Sea View Residence" },
                  { propertyId: "property-3", title: "Jomtien Family Corner Condo" },
                  { propertyId: "property-4", title: "Pratumnak Investment One-Bed" }
                ],
                role: "assistant",
                text: "Я нашла 3 подходящих варианта."
              }
            ],
            expires_at: new Date(Date.now() + 60_000),
            id: "handoff-1",
            locale: "ru",
            recipient_id: "telegram-chat-1",
            status: "linked",
            tenant_id: "tenant-1"
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] });
    const chat = chatService();
    const service = new PublicWidgetMessengerHandoffService(pool, tenantService(), chat);

    const linkedReply = await service.handleTelegramMessage("demo-agency", "telegram-chat-1", "/start pf_transfer-token-1");

    expect(linkedReply).toContain("можем продолжить в Telegram");
    expect(linkedReply).toContain("Короткий контекст");
    expect(linkedReply).toContain("Ваш запрос: Хочу кондо в Паттайе");
    expect(linkedReply).toContain("1. Wongamat Sea View Residence");
    expect(linkedReply).not.toContain("Консьерж:");
    await expect(service.handleTelegramMessage("demo-agency", "telegram-chat-1", "Какой ближе к пляжу?")).resolves.toBe(
      "Wongamat ближе всего к пляжу."
    );
    expect(chat.ask).toHaveBeenCalledWith("tenant-1", {
      conversation: [
        { role: "user", text: "Хочу кондо в Паттайе с бассейном до 5 млн для релокации" },
        {
          recommendedListings: [
            { propertyId: "property-1", title: "Wongamat Sea View Residence" },
            { propertyId: "property-3", title: "Jomtien Family Corner Condo" },
            { propertyId: "property-4", title: "Pratumnak Investment One-Bed" }
          ],
          role: "assistant",
          text: "Я нашла 3 подходящих варианта."
        }
      ],
      locale: "ru",
      message: "Какой ближе к пляжу?"
    });
  });

  it("does not add customer Telegram chats to agency lead notification recipients", async () => {
    const pool = poolMock();
    const query = pool.query as unknown as ReturnType<typeof vi.fn>;
    query.mockResolvedValueOnce({ rows: [{ conversation: [{ role: "user", text: "Хочу кондо у моря" }], locale: "ru" }] });
    const service = new PublicWidgetMessengerHandoffService(pool, tenantService(), chatService());

    await service.handleTelegramMessage("demo-agency", "customer-chat-1", "/start pf_transfer-token-1");

    expect(query).toHaveBeenCalledWith(expect.stringContaining("public_widget_conversation_handoffs"), [
      "tenant-1",
      expect.any(String),
      "customer-chat-1",
      expect.any(Date)
    ]);
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining("leadTelegramChatIds"), expect.anything());
  });

  it("creates a qualified viewing lead from a Telegram continuation message with contact details", async () => {
    const pool = poolMock();
    const query = pool.query as unknown as ReturnType<typeof vi.fn>;
    query.mockResolvedValueOnce({
      rows: [
        {
          conversation: [
            { role: "user", text: "Хочу кондо в Паттайе с бассейном до 5 млн для релокации" },
            {
              recommendedListings: [{ propertyId: "property-1", title: "Wongamat Sea View Residence" }],
              role: "assistant",
              text: "Я нашла 3 подходящих варианта."
            },
            { role: "user", text: "мне подходит, можно посмотреть?" },
            {
              recommendedListings: [{ propertyId: "property-1", title: "property-1" }],
              role: "assistant",
              text: "Wongamat Sea View Residence ближе всего к пляжу."
            }
          ],
          expires_at: new Date(Date.now() + 60_000),
          id: "handoff-1",
          locale: "ru",
          recipient_id: "telegram-chat-1",
          status: "linked",
          tenant_id: "tenant-1"
        }
      ]
    });
    const chat = chatService();
    const leads = leadService();
    const service = new PublicWidgetMessengerHandoffService(pool, tenantService(), chat, leads);

    const reply = await service.handleTelegramMessage(
      "demo-agency",
      "telegram-chat-1",
      "я бы хотел посмотреть в понедельник в 10 утра, мой ТГ @GermanSklyarov"
    );

    expect(reply).toContain("отправила агентству вашу заявку");
    expect(reply).toContain("Wongamat Sea View Residence");
    expect(reply).not.toContain("lead-1");
    expect(reply).not.toContain("property-1");
    expect(chat.ask).not.toHaveBeenCalled();
    expect(leads.create).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        contactName: "GermanSklyarov",
        contactPhone: "Telegram @GermanSklyarov",
        preferredLocale: "ru",
        propertyId: "property-1",
        source: "ai-concierge",
        status: "qualified"
      })
    );
    expect(vi.mocked(leads.create).mock.calls[0]?.[1].message).toContain("Widget handoff request.");
    expect(vi.mocked(leads.create).mock.calls[0]?.[1].message).toContain("Visitor note: я бы хотел посмотреть в понедельник в 10 утра");
    expect(vi.mocked(leads.create).mock.calls[0]?.[1].message).toContain("Viewing time: понедельник в 10 утра");
    expect(vi.mocked(leads.create).mock.calls[0]?.[1].message).not.toContain("Viewing time: я бы хотел посмотреть");
    expect(vi.mocked(leads.create).mock.calls[0]?.[1].message).toContain("Purpose: Relocation");
    expect(vi.mocked(leads.create).mock.calls[0]?.[1].message).toContain("1. Wongamat Sea View Residence (property-1)");
    expect(vi.mocked(leads.create).mock.calls[0]?.[1].message).not.toContain("1. property-1 (property-1)");
    expect(vi.mocked(leads.create).mock.calls[0]?.[1].message).toContain("user: мне подходит, можно посмотреть?");
  });

  it("accepts Telegram Web bot-qualified start commands", async () => {
    const pool = poolMock();
    const query = pool.query as unknown as ReturnType<typeof vi.fn>;
    query.mockResolvedValueOnce({ rows: [{ conversation: [{ role: "user", text: "Хочу кондо у моря" }], locale: "ru" }] });
    const service = new PublicWidgetMessengerHandoffService(pool, tenantService(), chatService());

    await expect(
      service.handleTelegramMessage("demo-agency", "telegram-chat-1", "/start@propertyflow_demo_bot pf_transfer-token-1")
    ).resolves.toContain("можем продолжить в Telegram");
  });

  it("returns a clear reply when Telegram drops the handoff token", async () => {
    const service = new PublicWidgetMessengerHandoffService(poolMock(), tenantService(), chatService());

    await expect(service.handleTelegramMessage("demo-agency", "telegram-chat-1", "/start")).resolves.toContain("did not pass the transfer token");
  });
});

function poolMock(): Pool {
  const query = vi.fn().mockResolvedValue({ rows: [] });

  return {
    query
  } as unknown as Pool;
}

function tenantService(): TenantService {
  return {
    getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant())
  } as unknown as TenantService;
}

function chatService(): AiChatService {
  return {
    ask: vi.fn().mockResolvedValue({
      answer: "Wongamat ближе всего к пляжу.",
      matchedPropertyIds: ["property-1"],
      suggestedActions: []
    })
  } as unknown as AiChatService;
}

function leadService(): LeadService {
  return {
    create: vi.fn().mockResolvedValue({
      id: "lead-1",
      propertyId: "property-1",
      status: "qualified"
    })
  } as unknown as LeadService;
}

function tenant(widget: Partial<TenantSnapshot["widget"]> = {}): TenantSnapshot {
  return {
    branding: {
      displayName: "Demo Agency"
    },
    createdAt: "2026-08-20T00:00:00.000Z",
    domainStatus: "not-configured",
    id: "tenant-1",
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
    updatedAt: "2026-08-20T00:00:00.000Z",
    widget: {
      aiName: "Anna",
      aiNames: { ru: "Анна" },
      allowedOrigins: [],
      languages: ["ru", "en"],
      leadLineRecipientIds: [],
      leadQualificationFields: ["budget", "email", "phone"],
      leadTelegramBotToken: "telegram-token",
      leadTelegramBotUsername: "propertyflow_demo_bot",
      leadTelegramWebhookSecret: "telegram-secret",
      listingUrlTemplate: "/listings/:propertyId",
      personaGenders: { ru: "feminine" },
      tone: "friendly",
      welcomeMessage: "Hi",
      welcomeMessages: { ru: "Привет" },
      ...widget
    }
  };
}
