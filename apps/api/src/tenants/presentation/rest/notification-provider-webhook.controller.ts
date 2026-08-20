import { createHmac, timingSafeEqual } from "node:crypto";
import { Body, Controller, ForbiddenException, Get, Headers, Inject, Param, Post, Query, Req } from "@nestjs/common";
import type { TenantNotificationProviderCheckResponse, TenantSnapshot } from "@propertyflow/contracts";
import type { FastifyRequest } from "fastify";
import { PublicWidgetMessengerHandoffService } from "../../../chat/application/public-widget-messenger-handoff.service.js";
import { TenantService } from "../../application/tenant.service.js";

@Controller("public/v1/notifications")
export class NotificationProviderWebhookController {
  constructor(
    @Inject(TenantService) private readonly tenants: TenantService,
    @Inject(PublicWidgetMessengerHandoffService)
    private readonly messengerHandoffs: PublicWidgetMessengerHandoffService = undefined as never
  ) {}

  @Post("telegram/:tenantSlug")
  async handleTelegramWebhook(
    @Param("tenantSlug") tenantSlug: string,
    @Headers("x-telegram-bot-api-secret-token") secretToken: string | undefined,
    @Body() payload: TelegramWebhookPayload
  ): Promise<TenantNotificationProviderCheckResponse> {
    const tenant = await this.findTenantForReply(tenantSlug);

    if (!isTelegramWebhookSecretValid(tenant, secretToken)) {
      throw new ForbiddenException("Telegram webhook secret token is invalid");
    }

    const message = payload.message ?? payload.channel_post;
    const code = extractConnectionCode(message?.text);
    const chatId = message?.chat?.id === undefined ? undefined : String(message.chat.id);
    const label = formatTelegramRecipientLabel(message?.chat, message?.from);
    const conciergeReply =
      code || !this.messengerHandoffs ? null : await this.messengerHandoffs.handleTelegramMessage(tenantSlug, chatId, message?.text);

    if (conciergeReply) {
      await this.replyToTelegramText(tenant, chatId, conciergeReply);

      return {
        checkedAt: new Date().toISOString(),
        provider: "telegram",
        status: "connected"
      };
    }

    const result = await this.confirmWebhookConnection("telegram", code, chatId, label);
    await this.replyToTelegram(tenant, chatId, result);

    return result;
  }

  @Post("line/:tenantSlug")
  async handleLineWebhook(
    @Param("tenantSlug") tenantSlug: string,
    @Headers("x-line-signature") signature: string | undefined,
    @Req() request: RawBodyFastifyRequest,
    @Body() payload: LineWebhookPayload
  ): Promise<TenantNotificationProviderCheckResponse> {
    const tenant = await this.findTenantForReply(tenantSlug);

    if (!isLineWebhookSignatureValid(tenant, signature, request.rawBody)) {
      throw new ForbiddenException("LINE webhook signature is invalid");
    }

    const event = payload.events?.find((item) => extractConnectionCode(item.message?.text));
    const code = extractConnectionCode(event?.message?.text);
    const recipientId = event?.source?.groupId ?? event?.source?.roomId ?? event?.source?.userId;
    const label = event?.source?.type ? `LINE ${event.source.type}` : undefined;
    const result = await this.confirmWebhookConnection("line", code, recipientId, label);
    await this.replyToLine(tenant, event?.replyToken, result);

    return result;
  }

  @Get("whatsapp/:tenantSlug")
  async verifyWhatsappWebhook(
    @Param("tenantSlug") tenantSlug: string,
    @Query("hub.mode") mode: string | undefined,
    @Query("hub.verify_token") verifyToken: string | undefined,
    @Query("hub.challenge") challenge: string | undefined
  ): Promise<string> {
    const tenant = await this.findTenantForReply(tenantSlug);

    if (!isWhatsappWebhookVerifyTokenValid(tenant, mode, verifyToken) || challenge === undefined) {
      throw new ForbiddenException("WhatsApp webhook verify token is invalid");
    }

    return challenge;
  }

  @Post("whatsapp/:tenantSlug")
  async handleWhatsappWebhook(
    @Param("tenantSlug") tenantSlug: string,
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Req() request: RawBodyFastifyRequest,
    @Body() payload: WhatsappWebhookPayload
  ): Promise<TenantNotificationProviderCheckResponse> {
    const tenant = await this.findTenantForReply(tenantSlug);

    if (!isWhatsappWebhookSignatureValid(tenant, signature, request.rawBody)) {
      throw new ForbiddenException("WhatsApp webhook signature is invalid");
    }

    const message = payload.entry
      ?.flatMap((entry) => entry.changes ?? [])
      .flatMap((change) => change.value?.messages ?? [])
      .find((item) => extractConnectionCode(item.text?.body));
    const code = extractConnectionCode(message?.text?.body);
    const result = await this.confirmWebhookConnection("whatsapp", code, message?.from, message?.from);
    await this.replyToWhatsapp(tenant, message?.from, result);

    return result;
  }

  private confirmWebhookConnection(
    provider: "line" | "telegram" | "whatsapp",
    code: string | undefined,
    recipientId: string | undefined,
    recipientLabel: string | undefined
  ): Promise<TenantNotificationProviderCheckResponse> {
    if (!code || !recipientId) {
      return Promise.resolve({
        checkedAt: new Date().toISOString(),
        error: "Webhook did not include a valid PropertyFlowAI connection code and recipient.",
        provider,
        status: "failed"
      });
    }

    return this.tenants.confirmNotificationProviderConnection({
      code,
      consumedAt: new Date(),
      provider,
      recipientId,
      recipientLabel
    });
  }

  private async replyToTelegram(
    tenant: TenantSnapshot | null,
    chatId: string | undefined,
    result: TenantNotificationProviderCheckResponse
  ): Promise<void> {
    const token = tenant?.widget.leadTelegramBotToken;

    if (!tenant || !token || !chatId) {
      return;
    }

    await postJson(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      disable_web_page_preview: true,
      text: buildConnectionReply(result, tenant)
    });
  }

  private async replyToTelegramText(tenant: TenantSnapshot | null, chatId: string | undefined, text: string): Promise<void> {
    const token = tenant?.widget.leadTelegramBotToken;

    if (!tenant || !token || !chatId) {
      return;
    }

    await postJson(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      disable_web_page_preview: true,
      text
    });
  }

  private async replyToLine(
    tenant: TenantSnapshot | null,
    replyToken: string | undefined,
    result: TenantNotificationProviderCheckResponse
  ): Promise<void> {
    const token = tenant?.widget.leadLineChannelAccessToken;

    if (!tenant || !token || !replyToken) {
      return;
    }

    await postJson(
      "https://api.line.me/v2/bot/message/reply",
      {
        messages: [{ text: buildConnectionReply(result, tenant), type: "text" }],
        replyToken
      },
      {
        authorization: `Bearer ${token}`
      }
    );
  }

  private async replyToWhatsapp(
    tenant: TenantSnapshot | null,
    recipient: string | undefined,
    result: TenantNotificationProviderCheckResponse
  ): Promise<void> {
    const token = tenant?.widget.leadWhatsappAccessToken;
    const phoneNumberId = tenant?.widget.leadWhatsappPhoneNumberId;
    const graphVersion = tenant?.widget.leadWhatsappGraphApiVersion ?? "v20.0";

    if (!tenant || !token || !phoneNumberId || !recipient) {
      return;
    }

    await postJson(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        text: {
          body: buildConnectionReply(result, tenant),
          preview_url: false
        },
        to: recipient,
        type: "text"
      },
      {
        authorization: `Bearer ${token}`
      }
    );
  }

  private async findTenantForReply(tenantSlug: string): Promise<TenantSnapshot | null> {
    try {
      return await this.tenants.getActiveTenantBySlugOrThrow(tenantSlug);
    } catch (_error) {
      return null;
    }
  }
}

interface TelegramWebhookPayload {
  channel_post?: TelegramMessage;
  message?: TelegramMessage;
}

interface TelegramMessage {
  chat?: {
    first_name?: string;
    id?: number | string;
    title?: string;
    type?: string;
    username?: string;
  };
  from?: {
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  text?: string;
}

type RawBodyFastifyRequest = FastifyRequest & {
  rawBody?: Buffer | string;
};

interface LineWebhookPayload {
  events?: Array<{
    message?: {
      text?: string;
      type?: string;
    };
    replyToken?: string;
    source?: {
      groupId?: string;
      roomId?: string;
      type?: string;
      userId?: string;
    };
  }>;
}

interface WhatsappWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          text?: {
            body?: string;
          };
        }>;
      };
    }>;
  }>;
}

function extractConnectionCode(text: string | undefined): string | undefined {
  const match = text?.match(/\bPF-\d{6}\b/i);

  return match?.[0]?.toUpperCase();
}

function formatTelegramRecipientLabel(chat: TelegramMessage["chat"], from: TelegramMessage["from"]): string | undefined {
  if (chat?.title) {
    return chat.title;
  }

  if (chat?.username) {
    return `@${chat.username}`;
  }

  if (from?.username) {
    return `@${from.username}`;
  }

  return [from?.first_name, from?.last_name].filter(Boolean).join(" ") || chat?.first_name;
}

function buildConnectionReply(result: TenantNotificationProviderCheckResponse, tenant: TenantSnapshot): string {
  const agencyName = tenant.branding.displayName || tenant.name;

  if (result.status === "connected" && result.alreadyConnected) {
    return `✅ This account is already connected to ${agencyName}.\nYou will continue receiving qualified lead notifications in this chat.`;
  }

  if (result.status === "connected") {
    return `✅ PropertyFlowAI connected successfully.\nYou will now receive new qualified lead notifications from ${agencyName} in this chat.`;
  }

  return "❌ This connection code is invalid or has expired.\nPlease generate a new code in PropertyFlowAI and try again.";
}

function isLineWebhookSignatureValid(
  tenant: TenantSnapshot | null,
  signature: string | undefined,
  rawBody: Buffer | string | undefined
): boolean {
  const secret = tenant?.widget.leadLineChannelSecret?.trim();

  if (!secret) {
    return true;
  }

  if (!signature || rawBody === undefined) {
    return false;
  }

  const body = typeof rawBody === "string" ? Buffer.from(rawBody) : rawBody;
  const expected = createHmac("sha256", secret).update(body).digest("base64");

  return safeEqualText(expected, signature);
}

function isTelegramWebhookSecretValid(tenant: TenantSnapshot | null, secretToken: string | undefined): boolean {
  const expected = tenant?.widget.leadTelegramWebhookSecret?.trim();

  if (!expected) {
    return true;
  }

  return safeEqualText(expected, secretToken);
}

function isWhatsappWebhookVerifyTokenValid(
  tenant: TenantSnapshot | null,
  mode: string | undefined,
  verifyToken: string | undefined
): boolean {
  const expected = tenant?.widget.leadWhatsappWebhookVerifyToken?.trim();

  if (!expected) {
    return true;
  }

  return mode === "subscribe" && safeEqualText(expected, verifyToken);
}

function isWhatsappWebhookSignatureValid(
  tenant: TenantSnapshot | null,
  signature: string | undefined,
  rawBody: Buffer | string | undefined
): boolean {
  const secret = tenant?.widget.leadWhatsappAppSecret?.trim();

  if (!secret) {
    return true;
  }

  if (!signature?.startsWith("sha256=") || rawBody === undefined) {
    return false;
  }

  const body = typeof rawBody === "string" ? Buffer.from(rawBody) : rawBody;
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  return safeEqualText(expected, signature);
}

function safeEqualText(expected: string, actual: string | undefined): boolean {
  if (!actual) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers
      },
      body: JSON.stringify(body)
    });
  } catch (_error) {
    // Webhook replies are best-effort; the connection itself is already recorded by this point.
  }
}
