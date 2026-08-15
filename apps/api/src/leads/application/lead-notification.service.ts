import { Inject, Injectable, Logger } from "@nestjs/common";
import type { LeadSnapshot, TenantSnapshot } from "@propertyflow/contracts";
import { TenantService } from "../../tenants/application/tenant.service.js";

interface LeadNotificationPayload {
  event: "lead.created";
  lead: {
    contactEmail?: string;
    contactName: string;
    contactPhone?: string;
    createdAt: string;
    id: string;
    message?: string;
    preferredLocale?: string;
    priority?: string;
    propertyId?: string;
    source: string;
    status: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    subscriptionPlan: string;
  };
}

interface AiConciergeNotificationContext {
  clientTurns: string[];
  qualification: AiConciergeLeadQualification;
  recommendedListings: Array<{ propertyId: string; title: string }>;
  selectedListing?: { propertyId: string; title: string };
  visitorNote?: string;
}

interface AiConciergeLeadQualification {
  budget?: string;
  contractLength?: string;
  contactPreference?: string;
  preferredContactTime?: string;
  dealIntent?: string;
  moveInDate?: string;
  ownershipStructure?: string;
  purpose?: string;
  purchaseTiming?: string;
  viewingTime?: string;
}

@Injectable()
export class LeadNotificationService {
  private readonly logger = new Logger(LeadNotificationService.name);

  constructor(@Inject(TenantService) private readonly tenants: TenantService) {}

  async notifyLeadCreated(tenantId: string, lead: LeadSnapshot): Promise<void> {
    const tenant = await this.findTenant(tenantId);

    if (!tenant || tenant.widget.leadNotificationsEnabled === false) {
      return;
    }

    const payload = buildLeadNotificationPayload(tenant, lead);
    const deliveries = [
      this.sendTenantWebhook(tenant, payload),
      this.sendEmailNotification(tenant, payload),
      this.sendTelegramNotifications(tenant, payload),
      this.sendLineNotifications(tenant, payload),
      this.sendWhatsappNotifications(tenant, payload)
    ];

    await Promise.all(deliveries);
  }

  private async findTenant(tenantId: string): Promise<TenantSnapshot | null> {
    try {
      return await this.tenants.findActiveTenant(tenantId);
    } catch (error) {
      this.logger.warn(`Lead notification tenant lookup failed for ${tenantId}: ${toErrorMessage(error)}`);

      return null;
    }
  }

  private async sendTenantWebhook(tenant: TenantSnapshot, payload: LeadNotificationPayload): Promise<void> {
    if (!tenant.widget.leadWebhookUrl) {
      return;
    }

    await this.postJson(tenant.widget.leadWebhookUrl, payload, {
      "content-type": "application/json",
      "user-agent": "PropertyFlowAI-LeadNotifications/1.0"
    });
  }

  private async sendEmailNotification(tenant: TenantSnapshot, payload: LeadNotificationPayload): Promise<void> {
    const recipients = tenant.widget.leadNotificationEmails ?? [];
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.PROPERTYFLOW_EMAIL_FROM;

    if (!recipients.length || !apiKey || !from) {
      return;
    }

    await this.postJson(
      "https://api.resend.com/emails",
      {
        from,
        to: recipients,
        subject: `New qualified lead from ${tenant.branding.displayName || tenant.name}`,
        text: buildEmailText(payload)
      },
      {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      }
    );
  }

  private async sendTelegramNotifications(tenant: TenantSnapshot, payload: LeadNotificationPayload): Promise<void> {
    const chatIds = tenant.widget.leadTelegramChatIds ?? [];
    const token = tenant.widget.leadTelegramBotToken;

    if (!chatIds.length || !token) {
      return;
    }

    await Promise.all(
      chatIds.map((chatId) =>
        this.postJson(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            chat_id: chatId,
            disable_web_page_preview: true,
            text: buildMessengerText(payload)
          },
          {
            "content-type": "application/json"
          }
        )
      )
    );
  }

  private async sendLineNotifications(tenant: TenantSnapshot, payload: LeadNotificationPayload): Promise<void> {
    const recipientIds = tenant.widget.leadLineRecipientIds ?? [];
    const token = tenant.widget.leadLineChannelAccessToken;

    if (!recipientIds.length || !token) {
      return;
    }

    await Promise.all(
      recipientIds.map((recipientId) =>
        this.postJson(
          "https://api.line.me/v2/bot/message/push",
          {
            messages: [
              {
                text: buildMessengerText(payload),
                type: "text"
              }
            ],
            to: recipientId
          },
          {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
          }
        )
      )
    );
  }

  private async sendWhatsappNotifications(tenant: TenantSnapshot, payload: LeadNotificationPayload): Promise<void> {
    const recipients = tenant.widget.leadWhatsappRecipients ?? [];
    const token = tenant.widget.leadWhatsappAccessToken;
    const phoneNumberId = tenant.widget.leadWhatsappPhoneNumberId;
    const graphVersion = tenant.widget.leadWhatsappGraphApiVersion ?? "v20.0";

    if (!recipients.length || !token || !phoneNumberId) {
      return;
    }

    await Promise.all(
      recipients.map((recipient) =>
        this.postJson(
          `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            text: {
              body: buildMessengerText(payload),
              preview_url: false
            },
            to: recipient,
            type: "text"
          },
          {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
          }
        )
      )
    );
  }

  private async postJson(url: string, body: unknown, headers: Record<string, string>): Promise<void> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5_000)
      });

      if (!response.ok) {
        this.logger.warn(`Lead notification delivery failed with HTTP ${response.status} for ${url}`);
      }
    } catch (error) {
      this.logger.warn(`Lead notification delivery failed for ${url}: ${toErrorMessage(error)}`);
    }
  }
}

function buildLeadNotificationPayload(tenant: TenantSnapshot, lead: LeadSnapshot): LeadNotificationPayload {
  return {
    event: "lead.created",
    lead: {
      contactEmail: lead.contactEmail,
      contactName: lead.contactName,
      contactPhone: lead.contactPhone,
      createdAt: lead.createdAt,
      id: lead.id,
      message: lead.message,
      preferredLocale: lead.preferredLocale,
      priority: lead.priority,
      propertyId: lead.propertyId,
      source: lead.source,
      status: lead.status
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      subscriptionPlan: tenant.subscriptionPlan
    }
  };
}

function buildEmailText(payload: LeadNotificationPayload): string {
  const lead = payload.lead;
  const context = parseAiConciergeNotificationContext(payload);
  const agencyBaseUrl = getAgencyBaseUrl();
  const lines = [
    `New qualified lead from ${payload.tenant.name}`,
    "",
    `Lead: ${lead.contactName}`,
    `Source: ${lead.source}`,
    `Status: ${lead.status}`,
    lead.priority ? `Priority: ${lead.priority}` : undefined,
    lead.preferredLocale ? `Language: ${lead.preferredLocale}` : undefined,
    lead.contactEmail ? `Email: ${lead.contactEmail}` : undefined,
    lead.contactPhone ? `Phone: ${lead.contactPhone}` : undefined,
    context.visitorNote ? `Request: ${context.visitorNote}` : undefined,
    context.selectedListing ? `Selected listing: ${formatListing(context.selectedListing)}` : undefined,
    !context.selectedListing && lead.propertyId ? `Property ID: ${lead.propertyId}` : undefined,
    agencyBaseUrl ? `Lead queue: ${buildAgencyUrl(agencyBaseUrl, `/leads/${lead.id}`)}` : undefined,
    agencyBaseUrl && lead.propertyId ? `Listing: ${buildAgencyUrl(agencyBaseUrl, `/listings/${lead.propertyId}`)}` : undefined,
    "",
    context.clientTurns.length
      ? `Recent client messages:\n${context.clientTurns.map((turn) => `- ${trimText(turn, 240)}`).join("\n")}`
      : "Open the lead queue for conversation context.",
    lead.message && !context.visitorNote ? `\nConversation summary:\n${trimText(lead.message, 1800)}` : undefined
  ];

  return lines.filter((line): line is string => line !== undefined).join("\n");
}

function buildMessengerText(payload: LeadNotificationPayload): string {
  const lead = payload.lead;
  const context = parseAiConciergeNotificationContext(payload);
  const agencyBaseUrl = getAgencyBaseUrl();
  const lines = [
    "✨ New AI Concierge lead",
    `🏢 Agency: ${payload.tenant.name}`,
    `👤 Contact: ${lead.contactName}`,
    lead.preferredLocale ? `🌐 Language: ${lead.preferredLocale}` : undefined,
    lead.contactEmail ? `✉️ Email: ${lead.contactEmail}` : undefined,
    lead.contactPhone ? `📞 Phone: ${lead.contactPhone}` : undefined,
    context.qualification.contactPreference ? `💬 Contact channel: ${context.qualification.contactPreference}` : undefined,
    context.qualification.dealIntent ? `🧭 Intent: ${context.qualification.dealIntent}` : undefined,
    context.qualification.budget ? `💰 Budget: ${context.qualification.budget}` : undefined,
    context.qualification.purpose ? `🎯 Purpose: ${context.qualification.purpose}` : undefined,
    context.qualification.ownershipStructure ? `🪪 Ownership/quota: ${context.qualification.ownershipStructure}` : undefined,
    context.qualification.purchaseTiming ? `⏳ Purchase timing: ${context.qualification.purchaseTiming}` : undefined,
    context.qualification.moveInDate ? `📦 Move-in: ${context.qualification.moveInDate}` : undefined,
    context.qualification.contractLength ? `📄 Contract length: ${context.qualification.contractLength}` : undefined,
    context.qualification.viewingTime ? `🗓️ Viewing time: ${context.qualification.viewingTime}` : undefined,
    context.qualification.preferredContactTime ? `⏰ Preferred contact time: ${context.qualification.preferredContactTime}` : undefined,
    context.visitorNote ? `📝 Latest request: ${trimText(context.visitorNote, 280)}` : undefined,
    context.selectedListing ? `🏠 Selected listing: ${formatListing(context.selectedListing)}` : undefined,
    !context.selectedListing && lead.propertyId ? `🏠 Property ID: ${lead.propertyId}` : undefined,
    agencyBaseUrl ? `📋 Lead: ${buildAgencyUrl(agencyBaseUrl, `/leads/${lead.id}`)}` : undefined,
    agencyBaseUrl && lead.propertyId ? `🔗 Listing: ${buildAgencyUrl(agencyBaseUrl, `/listings/${lead.propertyId}`)}` : undefined,
    "",
    context.clientTurns.length
      ? ["💬 Recent client messages:", ...context.clientTurns.map((turn) => `- ${trimText(turn, 180)}`)].join("\n")
      : "Open the lead queue for conversation context."
  ];

  return trimText(lines.filter((line): line is string => line !== undefined).join("\n"), 1800);
}

function parseAiConciergeNotificationContext(payload: LeadNotificationPayload): AiConciergeNotificationContext {
  const message = payload.lead.message;

  if (!message?.includes("Widget handoff request.")) {
    return {
      clientTurns: [],
      qualification: {},
      recommendedListings: []
    };
  }

  const sections = splitLeadSections(message);
  const clientTurns = parseClientTurns(sections);
  const qualificationText = [parseLeadQualificationSection(sections), parseVisitorNote(sections), ...parseClientTurns(sections, Number.POSITIVE_INFINITY)]
    .filter(Boolean)
    .join("\n");
  const recommendedListings = parseRecommendedListings(sections);
  const selectedListing =
    recommendedListings.find((listing) => listing.propertyId === payload.lead.propertyId) ?? recommendedListings[0];

  return {
    clientTurns,
    qualification: parseLeadQualification(qualificationText),
    recommendedListings,
    selectedListing,
    visitorNote: parseVisitorNote(sections)
  };
}

function splitLeadSections(message: string): string[] {
  return message
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);
}

function parseVisitorNote(sections: string[]): string | undefined {
  const section = sections.find((item) => item.startsWith("Visitor note:"));
  const value = section?.replace(/^Visitor note:\s*/, "").trim();

  return value || undefined;
}

function parseLeadQualificationSection(sections: string[]): string | undefined {
  return sections.find((item) => item.startsWith("Lead qualification:"));
}

function parseRecommendedListings(sections: string[]): AiConciergeNotificationContext["recommendedListings"] {
  const section = sections.find((item) => item.startsWith("Recommended listings:"));

  if (!section) {
    return [];
  }

  return section
    .split("\n")
    .slice(1)
    .map(parseListingLine)
    .filter((listing): listing is { propertyId: string; title: string } => Boolean(listing))
    .slice(0, 3);
}

function parseClientTurns(sections: string[], limit = 4): string[] {
  const section = sections.find((item) => item.startsWith("Recent widget conversation:"));

  if (!section) {
    return [];
  }

  return section
    .split("\n")
    .map((line) => line.match(/^user:\s*(.+)$/)?.[1]?.trim())
    .filter((text): text is string => Boolean(text))
    .slice(-limit);
}

function parseLeadQualification(text: string): AiConciergeLeadQualification {
  return {
    budget: parseBudget(text),
    contractLength: parseQualifiedLine(text, "Contract length") ?? parseContractLength(text),
    contactPreference: parseContactPreference(text),
    preferredContactTime: parseQualifiedLine(text, "Preferred contact time") ?? parsePreferredContactTime(text),
    dealIntent: parseQualifiedLine(text, "Intent") ?? parseDealIntent(text),
    moveInDate: parseQualifiedLine(text, "Move-in") ?? parseMoveInDate(text),
    ownershipStructure: parseQualifiedLine(text, "Ownership/quota") ?? parseOwnershipStructure(text),
    purpose: parsePurpose(text),
    purchaseTiming: parseQualifiedLine(text, "Purchase timing") ?? parsePurchaseTiming(text),
    viewingTime: parseQualifiedLine(text, "Viewing time") ?? parseQualifiedLine(text, "Timing") ?? parseViewingTime(text)
  };
}

function parseQualifiedLine(text: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = text.match(new RegExp(`^${escaped}:\\s*(.+)$`, "im"))?.[1]?.trim();

  return value || undefined;
}

function parseDealIntent(text: string): string | undefined {
  const normalized = text.toLowerCase();

  if (/\b(?:rent|rental|lease|monthly|per month)\b|аренд|снять|เช่า|รายเดือน|ต่อเดือน|租|月租|每月/i.test(normalized)) {
    return "Rent";
  }

  if (/\b(?:buy|purchase|sale|ownership|freehold|quota)\b|купить|покуп|продаж|собствен|ซื้อ|ขาย|买|買|购买|購買/i.test(normalized)) {
    return "Buy";
  }

  return undefined;
}

function parseBudget(text: string): string | undefined {
  const match =
    text.match(/\b(?:under|below|max|up to|до|менее|ไม่เกิน|ต่ำกว่า|预算|预算是|ไม่เกิน)\s*([0-9]+(?:[.,][0-9]+)?\s*(?:m|million|млн|k|thousand|тыс)?)(?:\s*(?:thb|baht|бат))?/i) ??
    text.match(/\b([0-9]+(?:[.,][0-9]+)?\s*(?:m|million|млн|k|thousand|тыс)?)(?:\s*(?:thb|baht|бат))\b/i);

  if (!match?.[0]) {
    return undefined;
  }

  return normalizeQualificationValue(match[0]);
}

function parsePurpose(text: string): string | undefined {
  const normalized = text.toLowerCase();
  const candidates = [
    { label: "Investment", pattern: /(investment|invest|rental yield|yield|инвест|доходн|ลงทุน|投资|投資|收益)/gi },
    { label: "Relocation", pattern: /(relocation|relocat|move to|переезд|релокац|ย้าย|搬家|移居)/gi },
    { label: "Family living", pattern: /(family|school|семь|семья|школ|ครอบครัว|โรงเรียน|家庭|学校|學校)/gi },
    { label: "Personal use", pattern: /(personal use|for myself|live there|living|для себя|жить|อยู่อาศัย|自住|自己住)/gi }
  ];
  const latest = candidates
    .flatMap(({ label, pattern }) => [...normalized.matchAll(pattern)].map((match) => ({ index: match.index ?? -1, label })))
    .sort((left, right) => right.index - left.index)[0];

  return latest?.label;
}

function parseOwnershipStructure(text: string): string | undefined {
  const normalized = text.toLowerCase();

  if (/(foreign quota|foreigner|foreign name|иностранн|фаранг|ต่างชาติ|ชาวต่างชาติ|外国|外國|外籍)/i.test(normalized)) {
    return "Foreign quota";
  }

  if (/(thai quota|thai name|thai person|тайск|таец|тайца|คนไทย|ชื่อไทย|泰国人|泰國人|泰籍)/i.test(normalized)) {
    return "Thai name/quota";
  }

  if (/(company|company name|thai company|компан|บริษัท|公司)/i.test(normalized)) {
    return "Company";
  }

  return undefined;
}

function parsePurchaseTiming(text: string): string | undefined {
  const normalized = text.toLowerCase();

  if (!/(buy|purchase|ownership|freehold|quota|купить|покуп|собствен|ซื้อ|购买|購買|买|買)/i.test(normalized)) {
    return undefined;
  }

  const match = normalized.match(
    /(?:asap|soon|right away|this month|next month|this year|next year|in\s+[0-9]+\s+(?:weeks|months|years)|within\s+[0-9]+\s+(?:weeks|months|years)|в ближайшее время|срочно|в этом месяце|в следующем месяце|в этом году|в следующем году|через\s+[0-9]+\s+(?:недел|месяц|год)|เร็วๆนี้|เดือนนี้|เดือนหน้า|ปีนี้|ปีหน้า|今年|明年|下个月|下個月|这个月|這個月)/i
  );

  return match?.[0] ? normalizeQualificationValue(match[0]) : undefined;
}

function parseMoveInDate(text: string): string | undefined {
  const normalized = text.toLowerCase();

  if (!/(rent|rental|lease|move in|move-in|аренд|снять|заехать|въезд|เช่า|ย้ายเข้า|入住|租)/i.test(normalized)) {
    return undefined;
  }

  const match = normalized.match(
    /(?:move[-\s]?in|available from|start from|from|заезд|въезд|заехать|с\s+|ย้ายเข้า|入住)\s+(today|tomorrow|next week|next month|this weekend|[0-9]{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)|[0-9]{1,2}[./-][0-9]{1,2}(?:[./-][0-9]{2,4})?|сегодня|завтра|на следующей неделе|в следующем месяце|เดือนหน้า|พรุ่งนี้|明天|下周|下週|下个月|下個月)/i
  );

  return match?.[1] ? normalizeQualificationValue(match[1]) : undefined;
}

function parseContractLength(text: string): string | undefined {
  const match = text.match(
    /(?:for|contract|lease|term|на|контракт|срок|สัญญา|租期)\s*([0-9]+(?:[.,][0-9]+)?\s*(?:months|month|years|year|mo|мес|месяцев|месяца|месяц|года|год|лет|เดือน|ปี|个月|個月|年))|([0-9]+(?:[.,][0-9]+)?\s*(?:months|month|years|year|mo|мес|месяцев|месяца|месяц|года|год|лет|เดือน|ปี|个月|個月|年)\s*(?:contract|lease|term|контракт|договор|สัญญา|租期)?)/i
  );

  return match?.[1] || match?.[2] ? normalizeQualificationValue(match[1] ?? match[2]!) : undefined;
}

function parseContactPreference(text: string): string | undefined {
  const normalized = text.toLowerCase();

  if (/(whatsapp|ватсап|วอตส์แอป)/i.test(normalized)) {
    return "WhatsApp";
  }

  if (/(telegram|телеграм)/i.test(normalized)) {
    return "Telegram";
  }

  if (/(line|ไลน์)/i.test(normalized)) {
    return "LINE";
  }

  if (/(email|e-mail|почт|อีเมล|邮箱|郵箱)/i.test(normalized)) {
    return "Email";
  }

  if (/(phone|call|телефон|номер|звон|โทร|电话|電話)/i.test(normalized)) {
    return "Phone";
  }

  return undefined;
}

const timingPattern =
  /next week|next month|this weekend|weekend|day after tomorrow|tomorrow(?:\s+(?:morning|afternoon|evening|night))?|today(?:\s+(?:morning|afternoon|evening|night))?|in\s+[0-9]+\s+days?|within\s+[0-9]+\s+(?:days|weeks|months)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+[0-9]{1,2}(?::[0-9]{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?|[0-9]{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+at\s+[0-9]{1,2}(?::[0-9]{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?|следующ(?:ей|ий|ем)\s+\S+|через\s+[0-9]+\s+дн\w*|на\s+выходных|в\s+выходные|послезавтра|завтра(?:\s+(?:утром|днем|днём|вечером))?|сегодня(?:\s+(?:утром|днем|днём|вечером))?|วัน(?:นี้|พรุ่งนี้)|พรุ่งนี้|สัปดาห์หน้า|เดือนหน้า|明天(?:上午|下午|晚上)?|今天(?:上午|下午|晚上)?|后天|後天|周末|週末|下周|下週|下个月|下個月/gi;

const viewingTimingContextPattern =
  /\b(?:viewing|view|see it|see the|tour|visit|showing|appointment)\b|просмотр|посмотр|показ|посетить|встреч|ดูห้อง|นัดชม|ดูคอนโด|看房|看一下|参观|參觀|预约看|預約看/i;

const contactTimingContextPattern =
  /\b(?:contact|call|message|text|whatsapp|line|telegram|email|reach me|follow up)\b|связ|позвон|звон|напиш|сообщ|ватсап|телеграм|почт|лайн|โทร|ติดต่อ|ไลน์|อีเมล|微信|联系|聯繫|打电话|打電話|发消息|發消息/i;

function parseViewingTime(text: string): string | undefined {
  return parseContextualTiming(text, viewingTimingContextPattern);
}

function parsePreferredContactTime(text: string): string | undefined {
  return parseContextualTiming(text, contactTimingContextPattern);
}

function parseContextualTiming(text: string, contextPattern: RegExp): string | undefined {
  timingPattern.lastIndex = 0;
  const matches = [
    ...text.matchAll(
      timingPattern
    )
  ].filter((match) => contextPattern.test(getSentenceAround(text, match.index ?? 0, match[0].length)));
  const match = matches.at(-1);

  return match?.[0] ? normalizeQualificationValue(match[0]) : undefined;
}

function getSentenceAround(text: string, index: number, length: number): string {
  const before = text.slice(0, index);
  const after = text.slice(index + length);
  const start = Math.max(before.lastIndexOf("."), before.lastIndexOf("?"), before.lastIndexOf("!"), before.lastIndexOf("\n"), before.lastIndexOf("。"), before.lastIndexOf("？"), before.lastIndexOf("！")) + 1;
  const endCandidates = [after.indexOf("."), after.indexOf("?"), after.indexOf("!"), after.indexOf("\n"), after.indexOf("。"), after.indexOf("？"), after.indexOf("！")]
    .filter((candidate) => candidate >= 0)
    .map((candidate) => index + length + candidate);
  const end = endCandidates.length ? Math.min(...endCandidates) : text.length;

  return text.slice(start, end);
}

function normalizeQualificationValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseListingLine(line: string): { propertyId: string; title: string } | null {
  const match = line.match(/^\d+\.\s+(.+?)\s+\(([^)]+)\)$/);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    propertyId: match[2].trim(),
    title: match[1].trim()
  };
}

function formatListing(listing: { propertyId: string; title: string }): string {
  return `${listing.title} (${listing.propertyId})`;
}

function getAgencyBaseUrl(): string | undefined {
  return process.env.AGENCY_APP_BASE_URL?.replace(/\/+$/, "");
}

function buildAgencyUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}

function trimText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
