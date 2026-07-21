import { Inject, Injectable } from "@nestjs/common";
import type {
  TenantSnapshot,
  TenantWidgetLanguage,
  TenantWidgetPersonaGender,
  UpdateTenantSettingsRequest
} from "@propertyflow/contracts";
import type { Pool } from "pg";
import type { ThailandMarket } from "@propertyflow/domain";
import { PG_POOL } from "../../../database/database.constants.js";
import type { TenantRepository, TenantUsageRawMetrics } from "../../domain/tenant.repository.js";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: TenantSnapshot["status"];
  primary_market: ThailandMarket | null;
  custom_domain: string | null;
  domain_status: TenantSnapshot["domainStatus"];
  subscription_plan: TenantSnapshot["subscriptionPlan"];
  limits: TenantSnapshot["limits"];
  branding_display_name: string;
  branding_primary_color: string | null;
  branding_logo_url: string | null;
  widget_ai_name: string;
  widget_ai_names: Partial<Record<TenantWidgetLanguage, string>> | null;
  widget_welcome_message: string;
  widget_welcome_messages: Partial<Record<TenantWidgetLanguage, string>> | null;
  widget_persona_genders: Partial<Record<TenantWidgetLanguage, TenantWidgetPersonaGender>> | null;
  widget_languages: string[];
  created_at: Date;
  updated_at: Date;
}

interface CountRow {
  count: string;
}

const defaultWidgetSettings: TenantSnapshot["widget"] = {
  aiName: "Anna",
  aiNames: {
    en: "Anna",
    ru: "Анна",
    th: "มาลี",
    zh: "安娜"
  },
  languages: ["en", "ru", "th", "zh"],
  personaGenders: {
    en: "feminine",
    ru: "feminine",
    th: "feminine",
    zh: "neutral"
  },
  welcomeMessage: "Hi! I'm Anna, your AI property consultant.",
  welcomeMessages: {
    en: "Hi! I'm Anna, your AI property consultant.",
    ru: "Привет! Я Анна, ваш AI-консультант по недвижимости.",
    th: "สวัสดีค่ะ ฉันชื่อ Anna ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ",
    zh: "你好！我是 Anna，你的 AI 房产顾问。"
  }
};

@Injectable()
export class PgTenantRepository implements TenantRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findById(tenantId: string): Promise<TenantSnapshot | null> {
    const result = await this.pool.query<TenantRow>(
      `
        select *
        from tenants
        where id = $1
        limit 1
      `,
      [tenantId]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<TenantSnapshot | null> {
    const result = await this.pool.query<TenantRow>(
      `
        select *
        from tenants
        where slug = $1
        limit 1
      `,
      [slug]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async getUsage(tenantId: string, periodStart: Date, periodEnd: Date): Promise<TenantUsageRawMetrics> {
    const [properties, agents, aiCreditsMonthly, publicApiRequestsMonthly] = await Promise.all([
      this.count("select count(*) from properties where tenant_id = $1", [tenantId]),
      this.count("select count(*) from tenant_users where tenant_id = $1 and status = 'active'", [tenantId]),
      this.count(
        `
          select count(*)
          from audit_events
          where tenant_id = $1
            and created_at >= $2
            and created_at < $3
            and action = any($4)
        `,
        [
          tenantId,
          periodStart.toISOString(),
          periodEnd.toISOString(),
          [
            "chat.asked",
            "concierge.advised",
            "concierge.message_added",
            "pricing.model_training_requested",
            "property.ai_assistant",
            "property.ai_search",
            "property.price_recommended"
          ]
        ]
      ),
      this.count(
        `
          select coalesce(sum(quantity), 0) as count
          from tenant_usage_events
          where tenant_id = $1
            and event_type = 'public-api.request'
            and created_at >= $2
            and created_at < $3
        `,
        [tenantId, periodStart.toISOString(), periodEnd.toISOString()]
      )
    ]);

    return {
      properties,
      agents,
      aiCreditsMonthly,
      publicApiRequestsMonthly
    };
  }

  async updateSettings(tenantId: string, request: UpdateTenantSettingsRequest): Promise<TenantSnapshot | null> {
    const current = await this.findById(tenantId);

    if (!current) {
      return null;
    }

    const customDomain = request.customDomain?.trim() || undefined;
    const result = await this.pool.query<TenantRow>(
      `
        update tenants
        set
          primary_market = $2,
          custom_domain = $3,
          domain_status = $4,
          branding_display_name = $5,
          branding_primary_color = $6,
          branding_logo_url = $7,
          widget_ai_name = $8,
          widget_ai_names = $9,
          widget_welcome_message = $10,
          widget_welcome_messages = $11,
          widget_persona_genders = $12,
          widget_languages = $13,
          updated_at = $14
        where id = $1
        returning *
      `,
      [
        tenantId,
        request.primaryMarket ?? current.primaryMarket ?? null,
        customDomain ?? current.customDomain ?? null,
        customDomain && customDomain !== current.customDomain ? "pending-verification" : current.domainStatus ?? "not-configured",
        request.branding?.displayName ?? current.branding.displayName,
        request.branding?.primaryColor ?? current.branding.primaryColor ?? null,
        request.branding?.logoUrl ?? current.branding.logoUrl ?? null,
        request.widget?.aiName ?? current.widget.aiName,
        request.widget?.aiNames ?? current.widget.aiNames,
        request.widget?.welcomeMessage ?? current.widget.welcomeMessage,
        request.widget?.welcomeMessages ?? current.widget.welcomeMessages,
        request.widget?.personaGenders ?? current.widget.personaGenders,
        request.widget?.languages?.length ? request.widget.languages : current.widget.languages,
        new Date().toISOString()
      ]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  private toSnapshot(row: TenantRow): TenantSnapshot {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      primaryMarket: row.primary_market ?? undefined,
      customDomain: row.custom_domain ?? undefined,
      domainStatus: row.domain_status,
      subscriptionPlan: row.subscription_plan,
      limits: row.limits,
      branding: {
        displayName: row.branding_display_name,
        primaryColor: row.branding_primary_color ?? undefined,
        logoUrl: row.branding_logo_url ?? undefined
      },
      widget: {
        aiName: row.widget_ai_name || defaultWidgetSettings.aiName,
        aiNames: {
          ...defaultWidgetSettings.aiNames,
          ...(row.widget_ai_names ?? {}),
          en: row.widget_ai_name || row.widget_ai_names?.en || defaultWidgetSettings.aiNames.en
        },
        languages: filterSupportedLanguages(row.widget_languages),
        personaGenders: {
          ...defaultWidgetSettings.personaGenders,
          ...(row.widget_persona_genders ?? {})
        },
        welcomeMessage: row.widget_welcome_message || defaultWidgetSettings.welcomeMessage,
        welcomeMessages: {
          ...defaultWidgetSettings.welcomeMessages,
          ...(row.widget_welcome_messages ?? {}),
          en: row.widget_welcome_message || row.widget_welcome_messages?.en || defaultWidgetSettings.welcomeMessages.en
        }
      },
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private async count(sql: string, values: unknown[]): Promise<number> {
    const result = await this.pool.query<CountRow>(sql, values);
    return Number(result.rows[0]?.count ?? 0);
  }
}

function filterSupportedLanguages(languages: string[] | null | undefined): TenantWidgetLanguage[] {
  const supported: TenantWidgetLanguage[] = ["en", "ru", "th", "zh"];
  const filtered = (languages ?? []).filter((language): language is TenantWidgetLanguage =>
    supported.includes(language as TenantWidgetLanguage)
  );

  return filtered.length ? filtered : defaultWidgetSettings.languages;
}
