import { createHmac } from "node:crypto";
import { ForbiddenException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TenantSnapshot } from "@propertyflow/contracts";
import type { TenantService } from "../../application/tenant.service.js";
import { NotificationProviderWebhookController } from "./notification-provider-webhook.controller.js";

describe("NotificationProviderWebhookController", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts signed LINE webhooks and replies to the chat", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const body = JSON.stringify({
      events: [
        {
          message: { text: "PF-123456", type: "text" },
          replyToken: "reply-token-1",
          source: { type: "user", userId: "line-user-1" }
        }
      ]
    });
    const tenants = tenantService();
    const controller = new NotificationProviderWebhookController(tenants);

    await expect(
      controller.handleLineWebhook("demo-agency", signLineBody(body), { rawBody: Buffer.from(body) } as never, JSON.parse(body))
    ).resolves.toMatchObject({
      provider: "line",
      status: "connected"
    });
    expect(tenants.confirmNotificationProviderConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "PF-123456",
        provider: "line",
        recipientId: "line-user-1"
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/reply",
      expect.objectContaining({
        body: expect.stringContaining("PropertyFlowAI connected successfully")
      })
    );
  });

  it("rejects LINE webhooks with an invalid signature", async () => {
    const tenants = tenantService();
    const controller = new NotificationProviderWebhookController(tenants);
    const body = JSON.stringify({ events: [{ message: { text: "PF-123456" }, source: { userId: "line-user-1" } }] });

    await expect(
      controller.handleLineWebhook("demo-agency", "invalid-signature", { rawBody: Buffer.from(body) } as never, JSON.parse(body))
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tenants.confirmNotificationProviderConnection).not.toHaveBeenCalled();
  });

  it("rejects Telegram webhooks with an invalid secret token", async () => {
    const tenants = tenantService();
    const controller = new NotificationProviderWebhookController(tenants);

    await expect(
      controller.handleTelegramWebhook("demo-agency", "wrong-secret", {
        message: {
          chat: { id: 12345, type: "private" },
          text: "PF-123456"
        }
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tenants.confirmNotificationProviderConnection).not.toHaveBeenCalled();
  });

  it("verifies WhatsApp webhook challenges with the tenant verify token", async () => {
    const tenants = tenantService();
    const controller = new NotificationProviderWebhookController(tenants);

    await expect(
      controller.verifyWhatsappWebhook("demo-agency", "subscribe", "whatsapp-verify", "challenge-123")
    ).resolves.toBe("challenge-123");
  });

  it("rejects WhatsApp webhook challenges with an invalid verify token", async () => {
    const tenants = tenantService();
    const controller = new NotificationProviderWebhookController(tenants);

    await expect(controller.verifyWhatsappWebhook("demo-agency", "subscribe", "wrong-token", "challenge-123")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("accepts signed WhatsApp webhooks and replies to the chat", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const body = JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: "+66812345678", text: { body: "PF-123456" } }]
              }
            }
          ]
        }
      ]
    });
    const tenants = tenantService();
    const controller = new NotificationProviderWebhookController(tenants);

    await expect(
      controller.handleWhatsappWebhook("demo-agency", signWhatsappBody(body), { rawBody: Buffer.from(body) } as never, JSON.parse(body))
    ).resolves.toMatchObject({
      provider: "whatsapp",
      status: "connected"
    });
    expect(tenants.confirmNotificationProviderConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "PF-123456",
        provider: "whatsapp",
        recipientId: "+66812345678"
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v20.0/phone-number-1/messages",
      expect.objectContaining({
        body: expect.stringContaining("PropertyFlowAI connected successfully")
      })
    );
  });

  it("rejects WhatsApp webhooks with an invalid signature", async () => {
    const tenants = tenantService();
    const controller = new NotificationProviderWebhookController(tenants);
    const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: "+66812345678", text: { body: "PF-123456" } }] } }] }] });

    await expect(
      controller.handleWhatsappWebhook("demo-agency", "sha256=invalid", { rawBody: Buffer.from(body) } as never, JSON.parse(body))
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tenants.confirmNotificationProviderConnection).not.toHaveBeenCalled();
  });
});

function signLineBody(body: string): string {
  return createHmac("sha256", "line-secret").update(Buffer.from(body)).digest("base64");
}

function signWhatsappBody(body: string): string {
  return `sha256=${createHmac("sha256", "whatsapp-secret").update(Buffer.from(body)).digest("hex")}`;
}

function tenantService(): TenantService {
  return {
    confirmNotificationProviderConnection: vi.fn().mockImplementation((request: { provider: "line" | "telegram" | "whatsapp" }) =>
      Promise.resolve({
        checkedAt: "2026-08-08T08:00:00.000Z",
        displayName: "LINE user",
        provider: request.provider,
        status: "connected"
      })
    ),
    getActiveTenantBySlugOrThrow: vi.fn().mockResolvedValue(tenant())
  } as unknown as TenantService;
}

function tenant(): TenantSnapshot {
  return {
    branding: {
      displayName: "Demo Agency"
    },
    createdAt: "2026-08-08T08:00:00.000Z",
    domainStatus: "not-configured",
    id: "demo-agency",
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
    updatedAt: "2026-08-08T08:00:00.000Z",
    widget: {
      aiName: "Anna",
      aiNames: { en: "Anna" },
      allowedOrigins: [],
      languages: ["en"],
      leadLineChannelAccessToken: "line-token",
      leadLineChannelSecret: "line-secret",
      leadLineRecipientIds: [],
      leadQualificationFields: ["budget", "email", "phone"],
      leadTelegramBotToken: "telegram-token",
      leadTelegramWebhookSecret: "telegram-secret",
      leadWhatsappAccessToken: "whatsapp-token",
      leadWhatsappAppSecret: "whatsapp-secret",
      leadWhatsappGraphApiVersion: "v20.0",
      leadWhatsappPhoneNumberId: "phone-number-1",
      leadWhatsappWebhookVerifyToken: "whatsapp-verify",
      listingUrlTemplate: "/listings/:propertyId",
      personaGenders: { en: "feminine" },
      tone: "friendly",
      welcomeMessage: "Hi",
      welcomeMessages: { en: "Hi" }
    }
  };
}
