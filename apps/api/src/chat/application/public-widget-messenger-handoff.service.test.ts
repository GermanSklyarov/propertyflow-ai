import { describe, expect, it, vi, afterEach } from "vitest";
import type { TenantSnapshot } from "@propertyflow/contracts";
import type { Pool } from "pg";
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

  it("links Telegram /start and continues the same localized concierge conversation", async () => {
    const pool = poolMock();
    const query = pool.query as unknown as ReturnType<typeof vi.fn>;
    query
      .mockResolvedValueOnce({ rows: [{ locale: "ru" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            conversation: [{ role: "assistant", text: "Я нашла 3 варианта у пляжа." }],
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

    await expect(service.handleTelegramMessage("demo-agency", "telegram-chat-1", "/start pf_transfer-token-1")).resolves.toContain(
      "можем продолжить в Telegram"
    );
    await expect(service.handleTelegramMessage("demo-agency", "telegram-chat-1", "Какой ближе к пляжу?")).resolves.toBe(
      "Wongamat ближе всего к пляжу."
    );
    expect(chat.ask).toHaveBeenCalledWith("tenant-1", {
      conversation: [{ role: "assistant", text: "Я нашла 3 варианта у пляжа." }],
      locale: "ru",
      message: "Какой ближе к пляжу?"
    });
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

function tenant(): TenantSnapshot {
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
      listingUrlTemplate: "/listings/:propertyId",
      personaGenders: { ru: "feminine" },
      tone: "friendly",
      welcomeMessage: "Hi",
      welcomeMessages: { ru: "Привет" }
    }
  };
}
