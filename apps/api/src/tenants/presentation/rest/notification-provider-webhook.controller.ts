import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import type { TenantNotificationProviderCheckResponse } from "@propertyflow/contracts";
import { TenantService } from "../../application/tenant.service.js";

@Controller("public/v1/notifications")
export class NotificationProviderWebhookController {
  constructor(@Inject(TenantService) private readonly tenants: TenantService) {}

  @Post("telegram/:tenantSlug")
  handleTelegramWebhook(
    @Param("tenantSlug") _tenantSlug: string,
    @Body() payload: TelegramWebhookPayload
  ): Promise<TenantNotificationProviderCheckResponse> {
    const message = payload.message ?? payload.channel_post;
    const code = extractConnectionCode(message?.text);
    const chatId = message?.chat?.id === undefined ? undefined : String(message.chat.id);
    const label = formatTelegramRecipientLabel(message?.chat, message?.from);

    return this.confirmWebhookConnection("telegram", code, chatId, label);
  }

  @Post("line/:tenantSlug")
  handleLineWebhook(
    @Param("tenantSlug") _tenantSlug: string,
    @Body() payload: LineWebhookPayload
  ): Promise<TenantNotificationProviderCheckResponse> {
    const event = payload.events?.find((item) => extractConnectionCode(item.message?.text));
    const code = extractConnectionCode(event?.message?.text);
    const recipientId = event?.source?.groupId ?? event?.source?.roomId ?? event?.source?.userId;
    const label = event?.source?.type ? `LINE ${event.source.type}` : undefined;

    return this.confirmWebhookConnection("line", code, recipientId, label);
  }

  @Post("whatsapp/:tenantSlug")
  handleWhatsappWebhook(
    @Param("tenantSlug") _tenantSlug: string,
    @Body() payload: WhatsappWebhookPayload
  ): Promise<TenantNotificationProviderCheckResponse> {
    const message = payload.entry
      ?.flatMap((entry) => entry.changes ?? [])
      .flatMap((change) => change.value?.messages ?? [])
      .find((item) => extractConnectionCode(item.text?.body));
    const code = extractConnectionCode(message?.text?.body);

    return this.confirmWebhookConnection("whatsapp", code, message?.from, message?.from);
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

interface LineWebhookPayload {
  events?: Array<{
    message?: {
      text?: string;
      type?: string;
    };
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
