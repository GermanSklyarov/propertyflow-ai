import { Injectable, Logger } from "@nestjs/common";
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

  constructor(private readonly tenants: TenantService) {}

  async notifyLeadCreated(tenantId: string, lead: LeadSnapshot): Promise<void> {
    const tenant = await this.findTenant(tenantId);

    if (!tenant || tenant.widget.leadNotificationsEnabled === false) {
      return;
    }

    const payload = buildLeadNotificationPayload(tenant, lead);
    const deliveries = [
      this.sendTenantWebhook(tenant, payload),
      this.sendEmailNotification(tenant, payload)
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

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
