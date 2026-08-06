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
        body: JSON.stringify(body)
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
    lead.propertyId ? `Property ID: ${lead.propertyId}` : undefined,
    "",
    lead.message ? `Conversation summary:\n${lead.message}` : "Open the lead queue for conversation context."
  ];

  return lines.filter((line): line is string => line !== undefined).join("\n");
}

function buildMessengerText(payload: LeadNotificationPayload): string {
  const lead = payload.lead;
  const lines = [
    `New qualified lead: ${lead.contactName}`,
    `Agency: ${payload.tenant.name}`,
    `Source: ${lead.source}`,
    lead.preferredLocale ? `Language: ${lead.preferredLocale}` : undefined,
    lead.contactEmail ? `Email: ${lead.contactEmail}` : undefined,
    lead.contactPhone ? `Phone: ${lead.contactPhone}` : undefined,
    lead.propertyId ? `Property ID: ${lead.propertyId}` : undefined,
    "",
    lead.message ? trimText(lead.message, 1200) : "Open the lead queue for conversation context."
  ];

  return lines.filter((line): line is string => line !== undefined).join("\n");
}

function trimText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
