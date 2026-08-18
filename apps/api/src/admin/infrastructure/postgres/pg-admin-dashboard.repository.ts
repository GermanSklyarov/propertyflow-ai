import { Socket } from "node:net";
import { Inject, Injectable } from "@nestjs/common";
import type {
  SuperAdminAgencyCost,
  SuperAdminAgencyDrilldown,
  SuperAdminAiUsageRow,
  SuperAdminDashboardResponse,
  SuperAdminLimitAlert,
  SuperAdminMapsUsage,
  SuperAdminMessagingUsage,
  SuperAdminMetricCard,
  SuperAdminHealthStatus,
  SuperAdminSystemHealth,
  SuperAdminTenantIntegrationStatus,
  SuperAdminUsageByOperation,
  TenantSubscriptionPlan,
} from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { AdminDashboardRepository } from "../../domain/admin-dashboard.repository.js";

interface CountRow {
  count: string;
}

interface OverviewRow {
  tenant_id: string;
  agency_name: string;
  subscription_plan: TenantSubscriptionPlan;
  conversations: string;
  ai_requests: string;
  ai_messages: string;
  input_tokens: string;
  output_tokens: string;
  leads: string;
  qualified_leads: string;
  maps_requests: string;
  telegram_notifications: string;
  line_notifications: string;
  whatsapp_notifications: string;
  estimated_ai_cost_usd: string;
  estimated_cost_usd: string;
}

interface TenantIntegrationRow {
  tenant_id: string;
  agency_name: string;
  telegram_configured: boolean;
  line_configured: boolean;
  whatsapp_configured: boolean;
}

interface TenantIdentityRow {
  tenant_id: string;
  agency_name: string;
}

interface OperationRow {
  service: string;
  operation: string;
  quantity: string;
  estimated_cost_usd: string;
}

interface MapsRow {
  geocoding_requests: string;
  places_requests: string;
  location_enrichment_records: string;
  cache_hits: string;
  cache_misses: string;
  estimated_cost_usd: string;
}

interface MessagingRow {
  notifications: string;
  telegram_sent: string;
  telegram_failed: string;
  line_sent: string;
  line_failed: string;
  whatsapp_sent: string;
  whatsapp_failed: string;
  delivery_errors: string;
}

const starterLimits = {
  aiRequests: 10_000,
  conversations: 2_000,
  mapsRequests: 5_000,
};

const googleGeocodingFreeTier = 10_000;

@Injectable()
export class PgAdminDashboardRepository implements AdminDashboardRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getDashboard(
    periodStart: Date,
    periodEnd: Date,
    todayStart: Date,
  ): Promise<SuperAdminDashboardResponse> {
    const [
      monthRows,
      todayRows,
      usageByOperation,
      maps,
      messaging,
      tenantIntegrations,
      systemHealth,
    ] = await Promise.all([
      this.getAgencyRows(periodStart, periodEnd),
      this.getAgencyRows(todayStart, periodEnd),
      this.getUsageByOperation(periodStart, periodEnd),
      this.getMapsUsage(periodStart, periodEnd),
      this.getMessagingUsage(periodStart, periodEnd),
      this.getTenantIntegrations(),
      this.getSystemHealth(periodStart, periodEnd),
    ]);

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      cards: this.buildCards(todayRows, monthRows),
      agencyCosts: this.buildAgencyCosts(monthRows),
      aiUsage: this.buildAiUsage(monthRows),
      usageByOperation,
      maps,
      messaging,
      tenantIntegrations,
      limits: this.buildLimitAlerts(monthRows),
      agencies: this.buildAgencyDrilldowns(monthRows),
      systemHealth,
      generatedAt: new Date().toISOString(),
    };
  }

  private async getAgencyRows(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<OverviewRow[]> {
    const result = await this.pool.query<OverviewRow>(
      `
        with tenant_list as (
          select id, name, subscription_plan
          from tenants
          where status = 'active'
        ),
        conversations as (
          select tenant_id, count(*) as conversations
          from concierge_sessions
          where created_at >= $1 and created_at < $2
          group by tenant_id
        ),
        widget_usage as (
          select
            tenant_id,
            count(*) as widget_asks,
            coalesce(
              nullif(count(distinct nullif(metadata ->> 'sessionId', '')), 0),
              count(*)
            ) as widget_conversations
          from tenant_usage_events
          where created_at >= $1 and created_at < $2
            and operation = 'public-widget.ask'
          group by tenant_id
        ),
        ai_messages as (
          select tenant_id, count(*) as ai_messages
          from concierge_messages
          where role = 'assistant'
            and created_at >= $1 and created_at < $2
          group by tenant_id
        ),
        ai_audit as (
          select tenant_id, count(*) as ai_requests
          from audit_events
          where created_at >= $1 and created_at < $2
            and action = any($3)
          group by tenant_id
        ),
        leads_month as (
          select
            tenant_id,
            count(*) as leads,
            count(*) filter (where status = 'qualified') as qualified_leads
          from leads
          where created_at >= $1 and created_at < $2
          group by tenant_id
        ),
        usage_month as (
          select
            tenant_id,
            coalesce(sum(estimated_cost_usd), 0) as estimated_cost_usd,
            coalesce(sum(estimated_cost_usd) filter (where service in ('openai', 'anthropic', 'gemini', 'openrouter', 'llm')), 0) as estimated_ai_cost_usd,
            coalesce(sum(quantity) filter (where service in ('openai', 'anthropic', 'gemini', 'openrouter', 'llm')), 0) as usage_ai_requests,
            coalesce(sum(quantity) filter (where service = 'google_maps'), 0) as maps_requests,
            coalesce(sum(quantity) filter (where service = 'telegram'), 0) as telegram_notifications,
            coalesce(sum(quantity) filter (where service = 'line'), 0) as line_notifications,
            coalesce(sum(quantity) filter (where service = 'whatsapp'), 0) as whatsapp_notifications,
            coalesce(sum(
              case
                when metadata ->> 'inputTokens' ~ '^[0-9]+$' then (metadata ->> 'inputTokens')::numeric
                else 0
              end
            ), 0) as input_tokens,
            coalesce(sum(
              case
                when metadata ->> 'outputTokens' ~ '^[0-9]+$' then (metadata ->> 'outputTokens')::numeric
                else 0
              end
            ), 0) as output_tokens
          from tenant_usage_events
          where created_at >= $1 and created_at < $2
          group by tenant_id
        )
        select
          tenant.id as tenant_id,
          tenant.name as agency_name,
          tenant.subscription_plan,
          greatest(coalesce(conversations.conversations, 0), coalesce(widget_usage.widget_conversations, 0)) as conversations,
          greatest(coalesce(ai_audit.ai_requests, 0), coalesce(usage_month.usage_ai_requests, 0), coalesce(widget_usage.widget_asks, 0)) as ai_requests,
          greatest(coalesce(ai_messages.ai_messages, 0), coalesce(widget_usage.widget_asks, 0)) as ai_messages,
          coalesce(usage_month.input_tokens, 0) as input_tokens,
          coalesce(usage_month.output_tokens, 0) as output_tokens,
          coalesce(leads_month.leads, 0) as leads,
          coalesce(leads_month.qualified_leads, 0) as qualified_leads,
          coalesce(usage_month.maps_requests, 0) as maps_requests,
          coalesce(usage_month.telegram_notifications, 0) as telegram_notifications,
          coalesce(usage_month.line_notifications, 0) as line_notifications,
          coalesce(usage_month.whatsapp_notifications, 0) as whatsapp_notifications,
          coalesce(usage_month.estimated_ai_cost_usd, 0) as estimated_ai_cost_usd,
          coalesce(usage_month.estimated_cost_usd, 0) as estimated_cost_usd
        from tenant_list tenant
        left join conversations on conversations.tenant_id = tenant.id
        left join widget_usage on widget_usage.tenant_id = tenant.id
        left join ai_messages on ai_messages.tenant_id = tenant.id
        left join ai_audit on ai_audit.tenant_id = tenant.id
        left join leads_month on leads_month.tenant_id = tenant.id
        left join usage_month on usage_month.tenant_id = tenant.id
        order by tenant.name asc
      `,
      [periodStart.toISOString(), periodEnd.toISOString(), aiAuditActions],
    );

    return result.rows;
  }

  private async getUsageByOperation(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<SuperAdminUsageByOperation[]> {
    const result = await this.pool.query<OperationRow>(
      `
        select
          service,
          operation,
          coalesce(sum(quantity), 0) as quantity,
          coalesce(sum(estimated_cost_usd), 0) as estimated_cost_usd
        from tenant_usage_events
        where created_at >= $1 and created_at < $2
        group by service, operation
        order by estimated_cost_usd desc, quantity desc, service asc, operation asc
        limit 25
      `,
      [periodStart.toISOString(), periodEnd.toISOString()],
    );
    const totalCost = result.rows.reduce(
      (sum, row) => sum + toNumber(row.estimated_cost_usd),
      0,
    );

    return result.rows.map((row) => ({
      service: row.service,
      operation: row.operation,
      quantity: toNumber(row.quantity),
      estimatedCostUsd: roundMoney(toNumber(row.estimated_cost_usd)),
      costSharePercent:
        totalCost > 0
          ? roundPercent((toNumber(row.estimated_cost_usd) / totalCost) * 100)
          : 0,
    }));
  }

  private async getMapsUsage(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<SuperAdminMapsUsage> {
    const result = await this.pool.query<MapsRow>(
      `
        with google_maps_usage as (
          select
            coalesce(sum(quantity) filter (where operation ilike '%geocod%'), 0) as geocoding_requests,
            coalesce(sum(quantity) filter (where operation ilike '%place%'), 0) as places_requests,
            coalesce(sum(quantity) filter (where operation ilike '%cache_hit%' or metadata ->> 'cacheResult' = 'hit'), 0) as cache_hits,
            coalesce(sum(quantity) filter (where operation ilike '%cache_miss%' or metadata ->> 'cacheResult' = 'miss'), 0) as cache_misses,
            coalesce(sum(estimated_cost_usd), 0) as estimated_cost_usd
          from tenant_usage_events
          where service = 'google_maps'
            and created_at >= $1 and created_at < $2
        ),
        location_enrichment as (
          select count(*)::int as location_enrichment_records
          from listing_location_features
          where updated_at >= $1 and updated_at < $2
        )
        select
          google_maps_usage.geocoding_requests,
          google_maps_usage.places_requests,
          location_enrichment.location_enrichment_records,
          google_maps_usage.cache_hits,
          google_maps_usage.cache_misses,
          google_maps_usage.estimated_cost_usd
        from google_maps_usage
        cross join location_enrichment
      `,
      [periodStart.toISOString(), periodEnd.toISOString()],
    );
    const row = result.rows[0];
    const cacheHits = toNumber(row?.cache_hits);
    const cacheMisses = toNumber(row?.cache_misses);
    const cacheTotal = cacheHits + cacheMisses;
    const geocodingRequests = toNumber(row?.geocoding_requests);

    return {
      geocodingRequests,
      placesRequests: toNumber(row?.places_requests),
      locationEnrichmentRecords: toNumber(row?.location_enrichment_records),
      cacheHits,
      cacheMisses,
      cacheHitRate:
        cacheTotal > 0 ? roundPercent((cacheHits / cacheTotal) * 100) : 0,
      estimatedCostUsd: roundMoney(toNumber(row?.estimated_cost_usd)),
      freeTierUsage: {
        geocoding: {
          used: geocodingRequests,
          limit: googleGeocodingFreeTier,
        },
      },
    };
  }

  private async getMessagingUsage(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<SuperAdminMessagingUsage> {
    const result = await this.pool.query<MessagingRow>(
      `
        select
          coalesce(sum(quantity) filter (where service in ('telegram', 'line', 'whatsapp', 'email', 'webhook')), 0) as notifications,
          coalesce(sum(quantity) filter (where service = 'telegram' and operation not ilike '%fail%'), 0) as telegram_sent,
          coalesce(sum(quantity) filter (where service = 'telegram' and operation ilike '%fail%'), 0) as telegram_failed,
          coalesce(sum(quantity) filter (where service = 'line' and operation not ilike '%fail%'), 0) as line_sent,
          coalesce(sum(quantity) filter (where service = 'line' and operation ilike '%fail%'), 0) as line_failed,
          coalesce(sum(quantity) filter (where service = 'whatsapp' and operation not ilike '%fail%'), 0) as whatsapp_sent,
          coalesce(sum(quantity) filter (where service = 'whatsapp' and operation ilike '%fail%'), 0) as whatsapp_failed,
          coalesce(sum(quantity) filter (where operation ilike '%fail%' or operation ilike '%error%'), 0) as delivery_errors
        from tenant_usage_events
        where created_at >= $1 and created_at < $2
      `,
      [periodStart.toISOString(), periodEnd.toISOString()],
    );
    const row = result.rows[0];

    return {
      notifications: toNumber(row?.notifications),
      telegramSent: toNumber(row?.telegram_sent),
      telegramFailed: toNumber(row?.telegram_failed),
      lineSent: toNumber(row?.line_sent),
      lineFailed: toNumber(row?.line_failed),
      whatsappSent: toNumber(row?.whatsapp_sent),
      whatsappFailed: toNumber(row?.whatsapp_failed),
      deliveryErrors: toNumber(row?.delivery_errors),
    };
  }

  private async getSystemHealth(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<SuperAdminSystemHealth> {
    const [
      postgresOk,
      redisStatus,
      failedJobs,
      webhookFailures,
      failedNotifications,
      errors,
    ] = await Promise.all([
      this.pingPostgres(),
      this.getRedisStatus(),
      this.count(
        `
          select count(*)
          from audit_events
          where created_at >= $1 and created_at < $2
            and (action ilike '%job%failed%' or action = 'job.enqueue_rejected')
        `,
        [periodStart.toISOString(), periodEnd.toISOString()],
      ),
      this.count(
        `
          select count(*)
          from tenant_usage_events
          where created_at >= $1 and created_at < $2
            and service = 'webhook'
            and (operation ilike '%fail%' or operation ilike '%error%')
        `,
        [periodStart.toISOString(), periodEnd.toISOString()],
      ),
      this.count(
        `
          select count(*)
          from tenant_usage_events
          where created_at >= $1 and created_at < $2
            and service in ('telegram', 'line', 'whatsapp', 'email')
            and (operation ilike '%fail%' or operation ilike '%error%')
        `,
        [periodStart.toISOString(), periodEnd.toISOString()],
      ),
      this.count(
        `
          select count(*)
          from audit_events
          where created_at >= $1 and created_at < $2
            and (action ilike '%failed%' or action ilike '%rejected%' or action ilike '%blocked%')
        `,
        [periodStart.toISOString(), periodEnd.toISOString()],
      ),
    ]);

    return {
      api: "ok",
      postgresql: postgresOk ? "ok" : "degraded",
      redis: redisStatus,
      llmProvider: getLlmProviderStatus(),
      googleMaps: process.env.GOOGLE_MAPS_API_KEY ? "configured" : "not_configured",
      messagingDelivery: failedNotifications > 0 ? "degraded" : "ok",
      failedJobs,
      webhookFailures,
      failedNotifications,
      errorRate: errors > 0 ? 100 : 0,
    };
  }

  private buildCards(
    todayRows: OverviewRow[],
    monthRows: OverviewRow[],
  ): SuperAdminMetricCard[] {
    return [
      this.card(
        "activeAgencies",
        "Active agencies",
        todayRows.length,
        monthRows.length,
      ),
      this.card(
        "conciergeConversations",
        "Concierge conversations",
        sum(todayRows, "conversations"),
        sum(monthRows, "conversations"),
      ),
      this.card(
        "aiMessagesRequests",
        "AI assistant messages",
        sum(todayRows, "ai_messages"),
        sum(monthRows, "ai_messages"),
      ),
      this.card(
        "leadsGenerated",
        "Leads generated",
        sum(todayRows, "leads"),
        sum(monthRows, "leads"),
      ),
      this.card(
        "qualifiedLeads",
        "Qualified leads",
        sum(todayRows, "qualified_leads"),
        sum(monthRows, "qualified_leads"),
      ),
      this.card(
        "llmTokensUsed",
        "LLM tokens used",
        sum(todayRows, "input_tokens") + sum(todayRows, "output_tokens"),
        sum(monthRows, "input_tokens") + sum(monthRows, "output_tokens"),
        "tokens",
      ),
      this.card(
        "estimatedAiCost",
        "Estimated AI cost",
        sum(todayRows, "estimated_ai_cost_usd"),
        sum(monthRows, "estimated_ai_cost_usd"),
        "usd",
      ),
      this.card(
        "googleMapsRequests",
        "Google Maps requests",
        sum(todayRows, "maps_requests"),
        sum(monthRows, "maps_requests"),
      ),
      this.card(
        "messengerNotifications",
        "Messenger notifications",
        notificationSum(todayRows),
        notificationSum(monthRows),
      ),
      this.card(
        "totalEstimatedInfrastructureCost",
        "Total estimated infrastructure cost",
        sum(todayRows, "estimated_cost_usd"),
        sum(monthRows, "estimated_cost_usd"),
        "usd",
      ),
      this.card(
        "costPerAgencyMonth",
        "Cost per agency / month",
        averageCost(todayRows),
        averageCost(monthRows),
        "usd",
      ),
    ];
  }

  private buildAgencyCosts(rows: OverviewRow[]): SuperAdminAgencyCost[] {
    return rows.map((row) => {
      const qualifiedLeads = toNumber(row.qualified_leads);
      const estimatedCostUsd = roundMoney(toNumber(row.estimated_cost_usd));

      return {
        tenantId: row.tenant_id,
        agencyName: row.agency_name,
        subscriptionPlan: row.subscription_plan,
        estimatedCostUsd,
        costPerQualifiedLeadUsd:
          qualifiedLeads > 0
            ? roundMoney(estimatedCostUsd / qualifiedLeads)
            : undefined,
      };
    });
  }

  private buildAiUsage(rows: OverviewRow[]): SuperAdminAiUsageRow[] {
    return rows.map((row) => ({
      tenantId: row.tenant_id,
      agencyName: row.agency_name,
      conversations: toNumber(row.conversations),
      llmRequests: toNumber(row.ai_requests),
      inputTokens: toNumber(row.input_tokens),
      outputTokens: toNumber(row.output_tokens),
      estimatedCostUsd: roundMoney(toNumber(row.estimated_ai_cost_usd)),
    }));
  }

  private buildLimitAlerts(rows: OverviewRow[]): SuperAdminLimitAlert[] {
    return rows.flatMap((row) => [
      this.limit(
        row,
        "aiRequests",
        toNumber(row.ai_requests),
        starterLimits.aiRequests,
      ),
      this.limit(
        row,
        "conversations",
        toNumber(row.conversations),
        starterLimits.conversations,
      ),
      this.limit(
        row,
        "mapsRequests",
        toNumber(row.maps_requests),
        starterLimits.mapsRequests,
      ),
    ]);
  }

  private buildAgencyDrilldowns(
    rows: OverviewRow[],
  ): SuperAdminAgencyDrilldown[] {
    return rows.map((row) => {
      const qualifiedLeads = toNumber(row.qualified_leads);
      const estimatedCostUsd = roundMoney(toNumber(row.estimated_cost_usd));

      return {
        tenantId: row.tenant_id,
        agencyName: row.agency_name,
        subscriptionPlan: row.subscription_plan,
        usageThisMonth: {
          conversations: toNumber(row.conversations),
          aiRequests: toNumber(row.ai_requests),
          tokens: toNumber(row.input_tokens) + toNumber(row.output_tokens),
          leads: toNumber(row.leads),
          qualifiedLeads,
          telegramNotifications: toNumber(row.telegram_notifications),
          lineNotifications: toNumber(row.line_notifications),
          whatsappNotifications: toNumber(row.whatsapp_notifications),
          mapsRequests: toNumber(row.maps_requests),
          estimatedCostUsd,
        },
        roi: {
          conversations: toNumber(row.conversations),
          leads: toNumber(row.leads),
          qualifiedLeads,
          viewingsOrBookings: 0,
          costPerQualifiedLeadUsd:
            qualifiedLeads > 0
              ? roundMoney(estimatedCostUsd / qualifiedLeads)
              : undefined,
        },
      };
    });
  }

  private card(
    key: string,
    label: string,
    today: number,
    month: number,
    unit?: string,
  ): SuperAdminMetricCard {
    return {
      key,
      label,
      today: unit === "usd" ? roundMoney(today) : today,
      month: unit === "usd" ? roundMoney(month) : month,
      unit,
    };
  }

  private limit(
    row: OverviewRow,
    metric: SuperAdminLimitAlert["metric"],
    used: number,
    limit: number,
  ): SuperAdminLimitAlert {
    const utilizationRate = limit > 0 ? roundPercent((used / limit) * 100) : 0;

    return {
      tenantId: row.tenant_id,
      agencyName: row.agency_name,
      metric,
      used,
      limit,
      utilizationRate,
      level:
        utilizationRate >= 100
          ? "critical"
          : utilizationRate >= 70
            ? "warning"
            : "ok",
    };
  }

  private async count(sql: string, values: unknown[]): Promise<number> {
    const result = await this.pool.query<CountRow>(sql, values);

    return toNumber(result.rows[0]?.count);
  }

  private async pingPostgres(): Promise<boolean> {
    try {
      await this.pool.query("select 1");

      return true;
    } catch {
      return false;
    }
  }

  private async getRedisStatus(): Promise<SuperAdminHealthStatus> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      return "not_configured";
    }

    try {
      const parsedUrl = new URL(redisUrl);
      const host = parsedUrl.hostname || "127.0.0.1";
      const port = parsedUrl.port ? Number(parsedUrl.port) : 6379;

      return await canOpenTcpConnection(host, port) ? "ok" : "degraded";
    } catch {
      return "degraded";
    }
  }

  private async getTenantIntegrations(): Promise<SuperAdminTenantIntegrationStatus[]> {
    const availableColumns = await this.getTenantColumns();
    const telegramConfiguredSql =
      hasColumns(availableColumns, ["widget_lead_telegram_bot_token", "widget_lead_telegram_chat_ids"])
        ? "nullif(trim(widget_lead_telegram_bot_token), '') is not null and cardinality(widget_lead_telegram_chat_ids) > 0"
        : "false";
    const lineConfiguredSql =
      hasColumns(availableColumns, ["widget_lead_line_channel_access_token", "widget_lead_line_recipient_ids"])
        ? "nullif(trim(widget_lead_line_channel_access_token), '') is not null and cardinality(widget_lead_line_recipient_ids) > 0"
        : "false";
    const whatsappConfiguredSql =
      hasColumns(availableColumns, [
        "widget_lead_whatsapp_access_token",
        "widget_lead_whatsapp_phone_number_id",
        "widget_lead_whatsapp_recipients",
      ])
        ? `
          nullif(trim(widget_lead_whatsapp_access_token), '') is not null
            and nullif(trim(widget_lead_whatsapp_phone_number_id), '') is not null
            and cardinality(widget_lead_whatsapp_recipients) > 0
        `
        : "false";

    const result = await this.pool.query<TenantIntegrationRow>(
      `
        select
          id as tenant_id,
          name as agency_name,
          ${telegramConfiguredSql} as telegram_configured,
          ${lineConfiguredSql} as line_configured,
          ${whatsappConfiguredSql} as whatsapp_configured
        from tenants
        where status = 'active'
        order by name asc
      `,
    );

    return result.rows.map((row) => ({
      tenantId: row.tenant_id,
      agencyName: row.agency_name,
      telegramConfigured: row.telegram_configured,
      lineConfigured: row.line_configured,
      whatsappConfigured: row.whatsapp_configured,
    }));
  }

  private async getTenantColumns(): Promise<Set<string>> {
    const result = await this.pool.query<{ column_name: string }>(
      `
        select column_name
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'tenants'
      `,
    );

    return new Set(result.rows.map((row) => row.column_name));
  }
}

function getLlmProviderStatus(): SuperAdminHealthStatus {
  if (
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK === "true"
  ) {
    return "configured";
  }

  return "not_configured";
}

function hasColumns(availableColumns: Set<string>, requiredColumns: string[]): boolean {
  return requiredColumns.every((column) => availableColumns.has(column));
}

function canOpenTcpConnection(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

const aiAuditActions = [
  "chat.asked",
  "concierge.advised",
  "concierge.message_added",
  "knowledge.document_embedding_requested",
  "pricing.model_training_requested",
  "property.ai_assistant",
  "property.ai_search",
  "property.price_recommended",
];

function sum(rows: OverviewRow[], key: keyof OverviewRow): number {
  return rows.reduce((total, row) => total + toNumber(row[key]), 0);
}

function notificationSum(rows: OverviewRow[]): number {
  return (
    sum(rows, "telegram_notifications") +
    sum(rows, "line_notifications") +
    sum(rows, "whatsapp_notifications")
  );
}

function averageCost(rows: OverviewRow[]): number {
  return rows.length > 0
    ? roundMoney(sum(rows, "estimated_cost_usd") / rows.length)
    : 0;
}

function toNumber(value: unknown): number {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}
