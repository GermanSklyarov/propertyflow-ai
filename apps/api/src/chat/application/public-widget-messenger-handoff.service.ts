import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  AiChatTurn,
  PublicWidgetMessengerHandoffOption,
  PublicWidgetMessengerHandoffResponse,
  PublicWidgetMessengerProvider,
  TenantSnapshot,
  TenantWidgetLanguage
} from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../database/database.constants.js";
import { TenantService } from "../../tenants/application/tenant.service.js";
import { AiChatService } from "./ai-chat.service.js";

const HANDOFF_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const MAX_STORED_TURNS = 12;
const SUPPORTED_PROVIDERS: PublicWidgetMessengerProvider[] = ["telegram", "line", "whatsapp"];

interface CreateMessengerHandoffRequest {
  conversation?: AiChatTurn[];
  locale: TenantWidgetLanguage;
  provider?: PublicWidgetMessengerProvider;
  sessionId?: string;
}

interface MessengerHandoffRow {
  conversation: AiChatTurn[];
  expires_at: Date | string;
  id: string;
  locale: TenantWidgetLanguage;
  recipient_id: string | null;
  status: "pending" | "linked" | "expired";
  tenant_id: string;
}

@Injectable()
export class PublicWidgetMessengerHandoffService {
  private readonly logger = new Logger(PublicWidgetMessengerHandoffService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(TenantService) private readonly tenants: TenantService,
    @Inject(AiChatService) private readonly chat: AiChatService
  ) {}

  async createHandoff(
    tenant: TenantSnapshot,
    payload: CreateMessengerHandoffRequest
  ): Promise<PublicWidgetMessengerHandoffResponse> {
    const requestedProviders = payload.provider ? [payload.provider] : SUPPORTED_PROVIDERS;
    const locale = resolveMessengerLocale(tenant.widget.languages, payload.locale);
    const options = await Promise.all(
      requestedProviders.map((provider) => this.createProviderOption(tenant, provider, locale, payload))
    );

    return {
      conciergeMode: tenant.subscriptionPlan,
      locale,
      options,
      tenantSlug: tenant.slug
    };
  }

  async handleTelegramMessage(tenantSlug: string, chatId: string | undefined, text: string | undefined): Promise<string | null> {
    if (!chatId || !text?.trim()) {
      return null;
    }

    const tenant = await this.tenants.getActiveTenantBySlugOrThrow(tenantSlug);
    const startToken = extractTelegramStartToken(text);

    if (startToken) {
      const linked = await this.linkTelegramHandoff(tenant, startToken, chatId);
      return linked
        ? buildMessengerLinkedReply(linked.locale, tenant, linked.conversation)
        : buildMessengerLinkExpiredReply(resolveMessengerLocale(tenant.widget.languages, "en"));
    }

    if (isTelegramStartCommand(text)) {
      return buildMessengerMissingTokenReply(resolveMessengerLocale(tenant.widget.languages, "en"));
    }

    const handoff = await this.findLinkedTelegramHandoff(tenant.id, chatId);

    if (!handoff) {
      return null;
    }

    const message = text.trim().slice(0, 2_000);
    const response = await this.chat.ask(tenant.id, {
      conversation: handoff.conversation,
      locale: handoff.locale,
      message
    });
    const nextConversation = trimConversation([
      ...handoff.conversation,
      { role: "user", text: message },
      {
        recommendedListings: response.matchedPropertyIds.slice(0, 3).map((propertyId) => ({ propertyId, title: propertyId })),
        role: "assistant",
        text: response.answer
      }
    ]);

    await this.pool.query(
      `
        update public_widget_conversation_handoffs
        set conversation = $3::jsonb,
            updated_at = $4
        where id = $1 and tenant_id = $2
      `,
      [handoff.id, tenant.id, JSON.stringify(nextConversation), new Date()]
    );

    return response.answer;
  }

  private async createProviderOption(
    tenant: TenantSnapshot,
    provider: PublicWidgetMessengerProvider,
    locale: TenantWidgetLanguage,
    payload: CreateMessengerHandoffRequest
  ): Promise<PublicWidgetMessengerHandoffOption> {
    if (provider !== "telegram") {
      return {
        provider,
        reason: "This messenger needs a public bot link in tenant settings before website visitors can open it.",
        status: "unsupported"
      };
    }

    const token = tenant.widget.leadTelegramBotToken?.trim();

    if (!token) {
      return {
        provider,
        reason: "Telegram bot token is not configured for this tenant.",
        status: "missing-credentials"
      };
    }

    if (!tenant.widget.leadTelegramWebhookSecret?.trim()) {
      return {
        provider,
        reason: "Telegram webhook is not connected. Register the bot webhook from tenant notification settings first.",
        status: "missing-credentials"
      };
    }

    const botUsername = normalizeTelegramBotUsername(tenant.widget.leadTelegramBotUsername) ?? (await this.resolveTelegramBotUsername(token));

    if (!botUsername) {
      return {
        provider,
        reason: "Telegram bot username is not configured and could not be resolved from the token.",
        status: "failed"
      };
    }

    const rawToken = randomBytes(18).toString("base64url");
    const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS);

    await this.pool.query(
      `
        insert into public_widget_conversation_handoffs (
          id, tenant_id, tenant_slug, provider, token_hash, session_id,
          locale, conversation, expires_at, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $10)
      `,
      [
        randomUUID(),
        tenant.id,
        tenant.slug,
        provider,
        hashHandoffToken(rawToken),
        payload.sessionId?.trim() || null,
        locale,
        JSON.stringify(trimConversation(payload.conversation ?? [])),
        expiresAt,
        new Date()
      ]
    );

    return {
      expiresAt: expiresAt.toISOString(),
      provider,
      status: "available",
      url: `https://t.me/${encodeURIComponent(botUsername)}?start=pf_${encodeURIComponent(rawToken)}`
    };
  }

  private async resolveTelegramBotUsername(token: string): Promise<string | null> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as { ok?: boolean; result?: { username?: string } };
      return payload.ok === true ? normalizeTelegramBotUsername(payload.result?.username) ?? null : null;
    } catch (error) {
      this.logger.warn(`Telegram bot username lookup failed tenantBotConfigured=true error=${String(error)}`);
      return null;
    }
  }

  private async linkTelegramHandoff(
    tenant: TenantSnapshot,
    rawToken: string,
    chatId: string
  ): Promise<{ conversation: AiChatTurn[]; locale: TenantWidgetLanguage } | null> {
    const result = await this.pool.query<MessengerHandoffRow>(
      `
        update public_widget_conversation_handoffs
        set recipient_id = $3,
            status = 'linked',
            linked_at = $4,
            updated_at = $4
        where tenant_id = $1
          and provider = 'telegram'
          and token_hash = $2
          and expires_at > $4
        returning conversation, locale
      `,
      [tenant.id, hashHandoffToken(rawToken), chatId, new Date()]
    );

    return result.rows[0] ? { conversation: result.rows[0].conversation, locale: result.rows[0].locale } : null;
  }

  private async findLinkedTelegramHandoff(tenantId: string, chatId: string): Promise<MessengerHandoffRow | null> {
    const result = await this.pool.query<MessengerHandoffRow>(
      `
        select id, tenant_id, recipient_id, locale, conversation, status, expires_at
        from public_widget_conversation_handoffs
        where tenant_id = $1
          and provider = 'telegram'
          and recipient_id = $2
          and status = 'linked'
          and expires_at > $3
        order by updated_at desc
        limit 1
      `,
      [tenantId, chatId, new Date()]
    );

    return result.rows[0] ?? null;
  }
}

function extractTelegramStartToken(text: string): string | null {
  const match = text.trim().match(/^\/start(?:@[A-Za-z0-9_]{5,32})?\s+pf_([A-Za-z0-9_-]{16,80})$/i);

  return match?.[1] ?? null;
}

function isTelegramStartCommand(text: string): boolean {
  return /^\/start(?:@[A-Za-z0-9_]{5,32})?$/i.test(text.trim());
}

function hashHandoffToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeTelegramBotUsername(value: string | undefined): string | undefined {
  const username = value?.trim().replace(/^@/, "");

  return username && /^[A-Za-z0-9_]{5,32}$/.test(username) ? username : undefined;
}

function resolveMessengerLocale(enabledLanguages: TenantWidgetLanguage[], requestedLocale: TenantWidgetLanguage): TenantWidgetLanguage {
  if (enabledLanguages.includes(requestedLocale)) {
    return requestedLocale;
  }

  return enabledLanguages[0] ?? "en";
}

function trimConversation(conversation: AiChatTurn[]): AiChatTurn[] {
  return conversation
    .filter((turn) => turn && (turn.role === "assistant" || turn.role === "user") && turn.text?.trim())
    .slice(-MAX_STORED_TURNS)
    .map((turn) => ({
      recommendedListings: (turn.recommendedListings ?? [])
        .filter((listing) => listing.propertyId?.trim() && listing.title?.trim())
        .slice(0, 3)
        .map((listing) => ({
          propertyId: listing.propertyId.trim().slice(0, 120),
          title: listing.title.trim().slice(0, 180)
        })),
      role: turn.role,
      text: turn.text.trim().slice(0, 2_000)
    }));
}

function buildMessengerLinkedReply(locale: TenantWidgetLanguage, tenant: TenantSnapshot, conversation: AiChatTurn[]): string {
  const agencyName = tenant.branding.displayName || tenant.name;
  const summary = buildTransferredConversationSummary(locale, conversation);
  const replies: Record<TenantWidgetLanguage, string> = {
    en: `Done. I brought your website conversation from ${agencyName} here, so we can continue in Telegram.${summary}`,
    ru: `Готово. Я перенесла сюда ваш диалог с сайта ${agencyName}, можем продолжить в Telegram.${summary}`,
    th: `เรียบร้อยค่ะ ฉันย้ายบทสนทนาจากเว็บไซต์ ${agencyName} มาที่นี่แล้ว คุยต่อใน Telegram ได้เลย${summary}`,
    zh: `完成。我已把您在 ${agencyName} 网站上的对话带到这里，可以继续在 Telegram 聊。${summary}`
  };

  return replies[locale] || replies.en;
}

function buildTransferredConversationSummary(locale: TenantWidgetLanguage, conversation: AiChatTurn[]): string {
  const turns = conversation ?? [];
  const lastUserMessage = turns
    .slice()
    .reverse()
    .find((turn) => turn.role === "user" && turn.text?.trim())?.text;
  const listings = Array.from(
    new Map(
      turns
        .flatMap((turn) => turn.recommendedListings ?? [])
        .filter((listing) => listing.propertyId?.trim() && listing.title?.trim())
        .map((listing) => [listing.propertyId, listing.title.trim()] as const)
    ).values()
  ).slice(0, 3);

  if (!lastUserMessage && !listings.length) {
    return "";
  }

  const copy: Record<TenantWidgetLanguage, { heading: string; listings: string; next: string; request: string }> = {
    en: {
      heading: "\n\nBrief context:",
      listings: "Shortlist",
      next: "You can ask me to compare them, check distance to the beach, or find more options.",
      request: "Your request"
    },
    ru: {
      heading: "\n\nКороткий контекст:",
      listings: "Подобранные варианты",
      next: "Можете попросить сравнить их, проверить расстояние до пляжа или найти еще варианты.",
      request: "Ваш запрос"
    },
    th: {
      heading: "\n\nสรุปสั้นๆ:",
      listings: "ตัวเลือกที่คัดไว้",
      next: "คุณถามให้ฉันเปรียบเทียบ เช็กระยะถึงชายหาด หรือหาตัวเลือกเพิ่มได้",
      request: "คำขอของคุณ"
    },
    zh: {
      heading: "\n\n简短上下文：",
      listings: "已选房源",
      next: "您可以让我比较它们、查看到海滩的距离，或继续找更多选择。",
      request: "您的需求"
    }
  };
  const labels = copy[locale] ?? copy.en;
  const lines = [labels.heading];

  if (lastUserMessage) {
    lines.push(`${labels.request}: ${trimForTelegramSummary(lastUserMessage, 180)}`);
  }

  if (listings.length) {
    lines.push(`${labels.listings}:`);
    lines.push(...listings.map((title, index) => `${index + 1}. ${trimForTelegramSummary(title, 120)}`));
  }

  lines.push(labels.next);

  return lines.join("\n");
}

function trimForTelegramSummary(text: string, limit = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  return normalized.length > limit ? `${normalized.slice(0, Math.max(limit - 3, 0))}...` : normalized;
}

function buildMessengerLinkExpiredReply(locale: TenantWidgetLanguage): string {
  const replies: Record<TenantWidgetLanguage, string> = {
    en: "This transfer link is invalid or expired. Please open the concierge on the website and create a new Telegram link.",
    ru: "Эта ссылка переноса устарела или недействительна. Откройте консьержа на сайте и создайте новую ссылку Telegram.",
    th: "ลิงก์ย้ายบทสนทนานี้หมดอายุหรือไม่ถูกต้อง กรุณาเปิด Concierge บนเว็บไซต์และสร้างลิงก์ Telegram ใหม่",
    zh: "此转移链接无效或已过期。请在网站上打开礼宾助手并创建新的 Telegram 链接。"
  };

  return replies[locale] || replies.en;
}

function buildMessengerMissingTokenReply(locale: TenantWidgetLanguage): string {
  const replies: Record<TenantWidgetLanguage, string> = {
    en: "I opened, but Telegram did not pass the transfer token. Please go back to the website and tap Continue in Telegram again.",
    ru: "Я открылась, но Telegram не передал токен переноса. Вернитесь на сайт и нажмите «Продолжить в Telegram» еще раз.",
    th: "เปิดแชตแล้ว แต่ Telegram ไม่ได้ส่งโทเคนย้ายบทสนทนา กรุณากลับไปที่เว็บไซต์แล้วกดคุยต่อใน Telegram อีกครั้ง",
    zh: "已打开聊天，但 Telegram 没有传递转移令牌。请返回网站并再次点击在 Telegram 继续。"
  };

  return replies[locale] || replies.en;
}
