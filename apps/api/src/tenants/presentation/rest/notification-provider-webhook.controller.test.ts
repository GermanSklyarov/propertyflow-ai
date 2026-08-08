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
});

function signLineBody(body: string): string {
  return createHmac("sha256", "line-secret").update(Buffer.from(body)).digest("base64");
}

function tenantService(): TenantService {
  return {
    confirmNotificationProviderConnection: vi.fn().mockResolvedValue({
      checkedAt: "2026-08-08T08:00:00.000Z",
      displayName: "LINE user",
      provider: "line",
      status: "connected"
    }),
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
      listingUrlTemplate: "/listings/:propertyId",
      personaGenders: { en: "feminine" },
      tone: "friendly",
      welcomeMessage: "Hi",
      welcomeMessages: { en: "Hi" }
    }
  };
}
