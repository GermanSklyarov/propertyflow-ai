import { Inject, Injectable } from "@nestjs/common";
import type {
  AcknowledgeSecurityEventRequest,
  CountByBucket,
  RequestUser,
  TenantSecurityEventsRequest,
  TenantSecurityEventSnapshot
} from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import { savedSearchFiltersMatchPropertySql } from "../../../properties/infrastructure/postgres/saved-search-filter-sql.js";
import type {
  AnalyticsRepository,
  TenantAnalyticsRawMetrics,
  TenantSecurityEventsQueryResult
} from "../../domain/analytics.repository.js";

interface CountRow {
  count: string;
}

interface BucketRow {
  bucket: string;
  count: string;
}

interface SecurityEventRow {
  id: string;
  audit_event_id: string;
  tenant_id: string;
  kind: TenantSecurityEventSnapshot["kind"];
  severity: TenantSecurityEventSnapshot["severity"];
  action: TenantSecurityEventSnapshot["action"];
  user_id: string | null;
  user_role: TenantSecurityEventSnapshot["userRole"] | null;
  resource_type: TenantSecurityEventSnapshot["resourceType"];
  resource_id: string | null;
  message: string;
  metadata: Record<string, unknown>;
  acknowledged_at: Date | null;
  acknowledged_by_user_id: string | null;
  acknowledged_by_user_role: TenantSecurityEventSnapshot["acknowledgedByUserRole"] | null;
  acknowledgement_note: string | null;
  created_at: Date;
}

interface LeadSlaMetricsRow {
  response_breached: string;
  response_due_soon: string;
  unassigned_breached: string;
  overdue_follow_ups: string;
  average_first_response_hours: string | null;
}

@Injectable()
export class PgAnalyticsRepository implements AnalyticsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getTenantMetrics(tenantId: string): Promise<TenantAnalyticsRawMetrics> {
    const [
      totalProperties,
      availableProperties,
      totalLeads,
      newLeads,
      unassignedLeads,
      leadSlaMetrics,
      leadSlaBreachedBySource,
      wonLeads,
      lostLeads,
      totalSearches,
      attributedLeads,
      averageSearchLatencyMs,
      leadsBySource,
      leadsByStatus,
      searchesBySource,
      topSearchQueries,
      leadsByAttributedSearchSource,
      topLeadSearchQueries,
      conciergeSessions,
      conciergeAwaitingInputSessions,
      conciergeRecommendedSessions,
      conciergeLeads,
      savedSearches,
      savedSearchLeads,
      savedSearchConvertedSearches,
      savedSearchOpenOpportunities,
      savedSearchMatchedProperties,
      savedSearchLeadCoveredMatches,
      conciergeFeedbackCount,
      conciergePositiveFeedbackCount,
      conciergeTrainingDatasetRows,
      conciergeTrainingLabeledRows,
      conciergeRecommendationsByArea,
      conciergeFeedbackByRating,
      rejectedJobEnqueues,
      blockedAiActions,
      imageDeletePreviews,
      imageRemovals,
      rejectedJobsByName,
      blockedAiActionsByName
    ] = await Promise.all([
      this.count("select count(*) from properties where tenant_id = $1", [tenantId]),
      this.count("select count(*) from properties where tenant_id = $1 and status = 'available'", [tenantId]),
      this.count("select count(*) from leads where tenant_id = $1", [tenantId]),
      this.count("select count(*) from leads where tenant_id = $1 and status = 'new'", [tenantId]),
      this.count("select count(*) from leads where tenant_id = $1 and assigned_agent_id is null", [tenantId]),
      this.leadSlaMetrics(tenantId),
      this.bucket(
        `
          select source as bucket, count(*)
          from leads
          where tenant_id = $1
            and status = 'new'
            and created_at <= now() - interval '4 hours'
          group by source
          order by count(*) desc, source asc
          limit 10
        `,
        [tenantId]
      ),
      this.count("select count(*) from leads where tenant_id = $1 and status = 'won'", [tenantId]),
      this.count("select count(*) from leads where tenant_id = $1 and status = 'lost'", [tenantId]),
      this.count("select count(*) from search_events where tenant_id = $1", [tenantId]),
      this.count("select count(*) from leads where tenant_id = $1 and attribution_search_query is not null", [tenantId]),
      this.average("select coalesce(avg(latency_ms), 0) as count from search_events where tenant_id = $1", [tenantId]),
      this.bucket("select source as bucket, count(*) from leads where tenant_id = $1 group by source order by count(*) desc", [
        tenantId
      ]),
      this.bucket("select status as bucket, count(*) from leads where tenant_id = $1 group by status order by count(*) desc", [
        tenantId
      ]),
      this.bucket(
        "select source as bucket, count(*) from search_events where tenant_id = $1 group by source order by count(*) desc",
        [tenantId]
      ),
      this.bucket(
        "select query as bucket, count(*) from search_events where tenant_id = $1 and query is not null group by query order by count(*) desc, query asc limit 10",
        [tenantId]
      ),
      this.bucket(
        "select attribution_search_source as bucket, count(*) from leads where tenant_id = $1 and attribution_search_source is not null group by attribution_search_source order by count(*) desc",
        [tenantId]
      ),
      this.bucket(
        "select attribution_search_query as bucket, count(*) from leads where tenant_id = $1 and attribution_search_query is not null group by attribution_search_query order by count(*) desc, attribution_search_query asc limit 10",
        [tenantId]
      ),
      this.count("select count(*) from concierge_sessions where tenant_id = $1", [tenantId]),
      this.count("select count(*) from concierge_sessions where tenant_id = $1 and status = 'awaiting-input'", [tenantId]),
      this.count("select count(*) from concierge_sessions where tenant_id = $1 and status = 'recommended'", [tenantId]),
      this.count("select count(*) from leads where tenant_id = $1 and source = 'ai-concierge'", [tenantId]),
      this.count("select count(*) from saved_property_searches where tenant_id = $1", [tenantId]),
      this.count("select count(*) from leads where tenant_id = $1 and source = 'saved-search'", [tenantId]),
      this.count(
        `
          select count(distinct search.id)
          from saved_property_searches search
          join leads lead
            on lead.tenant_id = search.tenant_id
            and lead.source = 'saved-search'
            and lead.attribution_search_event_id = search.id
          where search.tenant_id = $1
        `,
        [tenantId]
      ),
      this.count(
        `
          select count(*)
          from saved_property_searches search
          where search.tenant_id = $1
            and not exists (
              select 1
              from leads lead
              where lead.tenant_id = search.tenant_id
                and lead.source = 'saved-search'
                and lead.attribution_search_event_id = search.id
            )
            and exists (
              select 1
              from properties property
              where property.tenant_id = search.tenant_id
                and ${savedSearchFiltersMatchPropertySql("search", "property")}
            )
        `,
        [tenantId]
      ),
      this.count(
        `
          select count(*)
          from saved_property_searches search
          join properties property
            on property.tenant_id = search.tenant_id
            and ${savedSearchFiltersMatchPropertySql("search", "property")}
          where search.tenant_id = $1
        `,
        [tenantId]
      ),
      this.count(
        `
          select count(*)
          from saved_property_searches search
          join properties property
            on property.tenant_id = search.tenant_id
            and ${savedSearchFiltersMatchPropertySql("search", "property")}
          where search.tenant_id = $1
            and exists (
              select 1
              from leads lead
              where lead.tenant_id = search.tenant_id
                and lead.source = 'saved-search'
                and lead.attribution_search_event_id = search.id
                and lead.property_id = property.id
            )
        `,
        [tenantId]
      ),
      this.count("select count(*) from concierge_feedback where tenant_id = $1", [tenantId]),
      this.count("select count(*) from concierge_feedback where tenant_id = $1 and rating = 'positive'", [tenantId]),
      this.count("select count(*) from concierge_sessions where tenant_id = $1 and status = 'recommended'", [tenantId]),
      this.count(
        `
          select count(distinct session.id)
          from concierge_sessions session
          left join concierge_feedback feedback
            on feedback.tenant_id = session.tenant_id
            and feedback.session_id = session.id
          left join leads lead
            on lead.tenant_id = session.tenant_id
            and lead.source = 'ai-concierge'
            and lead.attribution_search_event_id = session.id
          where session.tenant_id = $1
            and session.status = 'recommended'
            and (
              feedback.rating is not null
              or feedback.selected_property_id is not null
              or lead.id is not null
            )
        `,
        [tenantId]
      ),
      this.bucket(
        `
          select session.latest_response->'areaRecommendation'->>'area' as bucket, count(*)
          from concierge_sessions session
          where session.tenant_id = $1
            and session.latest_response->'areaRecommendation'->>'area' is not null
          group by bucket
          order by count(*) desc, bucket asc
          limit 10
        `,
        [tenantId]
      ),
      this.bucket(
        "select rating as bucket, count(*) from concierge_feedback where tenant_id = $1 group by rating order by count(*) desc, rating asc",
        [tenantId]
      ),
      this.count("select count(*) from audit_events where tenant_id = $1 and action = 'job.enqueue_rejected'", [tenantId]),
      this.count(
        `
          select count(*)
          from audit_events event
          cross join lateral jsonb_array_elements(coalesce(event.metadata->'actionPolicy', '[]'::jsonb)) policy
          where event.tenant_id = $1
            and event.action = 'property.ai_assistant'
            and policy->>'decision' = 'blocked'
        `,
        [tenantId]
      ),
      this.count("select count(*) from audit_events where tenant_id = $1 and action = 'property.image_delete_previewed'", [
        tenantId
      ]),
      this.count("select count(*) from audit_events where tenant_id = $1 and action = 'property.image_removed'", [
        tenantId
      ]),
      this.bucket(
        `
          select coalesce(metadata->>'name', resource_id, 'unknown') as bucket, count(*)
          from audit_events
          where tenant_id = $1
            and action = 'job.enqueue_rejected'
          group by bucket
          order by count(*) desc, bucket asc
          limit 10
        `,
        [tenantId]
      ),
      this.bucket(
        `
          select policy->>'action' as bucket, count(*)
          from audit_events event
          cross join lateral jsonb_array_elements(coalesce(event.metadata->'actionPolicy', '[]'::jsonb)) policy
          where event.tenant_id = $1
            and event.action = 'property.ai_assistant'
            and policy->>'decision' = 'blocked'
            and policy->>'action' is not null
          group by bucket
          order by count(*) desc, bucket asc
          limit 10
        `,
        [tenantId]
      )
    ]);

    return {
      totalProperties,
      availableProperties,
      totalLeads,
      newLeads,
      unassignedLeads,
      leadSlaResponseBreached: leadSlaMetrics.responseBreached,
      leadSlaResponseDueSoon: leadSlaMetrics.responseDueSoon,
      leadSlaUnassignedBreached: leadSlaMetrics.unassignedBreached,
      leadSlaOverdueFollowUps: leadSlaMetrics.overdueFollowUps,
      leadSlaAverageFirstResponseHours: leadSlaMetrics.averageFirstResponseHours,
      leadSlaBreachedBySource,
      wonLeads,
      lostLeads,
      totalSearches,
      attributedLeads,
      averageSearchLatencyMs,
      leadsBySource,
      leadsByStatus,
      searchesBySource,
      topSearchQueries,
      leadsByAttributedSearchSource,
      topLeadSearchQueries,
      conciergeSessions,
      conciergeAwaitingInputSessions,
      conciergeRecommendedSessions,
      conciergeLeads,
      savedSearches,
      savedSearchLeads,
      savedSearchConvertedSearches,
      savedSearchOpenOpportunities,
      savedSearchMatchedProperties,
      savedSearchLeadCoveredMatches,
      conciergeFeedbackCount,
      conciergePositiveFeedbackCount,
      conciergeTrainingDatasetRows,
      conciergeTrainingLabeledRows,
      conciergeRecommendationsByArea,
      conciergeFeedbackByRating,
      rejectedJobEnqueues,
      blockedAiActions,
      imageDeletePreviews,
      imageRemovals,
      rejectedJobsByName,
      blockedAiActionsByName
    };
  }

  async listSecurityEvents(
    tenantId: string,
    request: TenantSecurityEventsRequest
  ): Promise<TenantSecurityEventsQueryResult> {
    const boundedLimit = Math.min(Math.max(request.limit ?? 50, 1), 100);
    const { filterSql, values } = this.securityEventFilters(tenantId, request);
    const limitValues = [...values, boundedLimit];
    const limitPlaceholder = `$${limitValues.length}`;
    const securityEventsSql = this.securityEventsSql();
    const [itemsResult, total, bySeverity, byKind, byAcknowledgement] = await Promise.all([
      this.pool.query<SecurityEventRow>(
        `
          select *
          from (${securityEventsSql}) security_events
          ${filterSql}
          order by created_at desc
          limit ${limitPlaceholder}
        `,
        limitValues
      ),
      this.count(
        `
          select count(*)
          from (${securityEventsSql}) security_events
          ${filterSql}
        `,
        values
      ),
      this.bucket(
        `
          select severity as bucket, count(*)
          from (${securityEventsSql}) security_events
          ${filterSql}
          group by severity
          order by count(*) desc, severity asc
        `,
        values
      ),
      this.bucket(
        `
          select kind as bucket, count(*)
          from (${securityEventsSql}) security_events
          ${filterSql}
          group by kind
          order by count(*) desc, kind asc
        `,
        values
      ),
      this.bucket(
        `
          select
            case when acknowledged_at is null then 'unacknowledged' else 'acknowledged' end as bucket,
            count(*)
          from (${securityEventsSql}) security_events
          ${filterSql}
          group by bucket
          order by count(*) desc, bucket asc
        `,
        values
      )
    ]);

    return {
      items: itemsResult.rows.map((row) => this.toSecurityEvent(row)),
      summary: {
        total,
        bySeverity,
        byKind,
        byAcknowledgement
      }
    };
  }

  async acknowledgeSecurityEvent(
    tenantId: string,
    eventId: string,
    request: AcknowledgeSecurityEventRequest,
    user: RequestUser
  ): Promise<TenantSecurityEventSnapshot | null> {
    const existing = await this.findSecurityEventById(tenantId, eventId);

    if (!existing) {
      return null;
    }

    await this.pool.query(
      `
        insert into security_event_acknowledgements (
          tenant_id,
          event_id,
          acknowledged_by_user_id,
          acknowledged_by_user_role,
          acknowledged_at,
          note
        ) values (
          $1,
          $2,
          $3,
          $4,
          now(),
          $5
        )
        on conflict (tenant_id, event_id) do update
        set acknowledged_by_user_id = excluded.acknowledged_by_user_id,
            acknowledged_by_user_role = excluded.acknowledged_by_user_role,
            acknowledged_at = excluded.acknowledged_at,
            note = excluded.note
      `,
      [tenantId, eventId, user.id, user.role, request.note ?? null]
    );

    return this.findSecurityEventById(tenantId, eventId);
  }

  private async findSecurityEventById(tenantId: string, eventId: string): Promise<TenantSecurityEventSnapshot | null> {
    const securityEventsSql = this.securityEventsSql();
    const result = await this.pool.query<SecurityEventRow>(
      `
        select *
        from (${securityEventsSql}) security_events
        where id = $2
      `,
      [tenantId, eventId]
    );

    return result.rows[0] ? this.toSecurityEvent(result.rows[0]) : null;
  }

  private securityEventsSql(): string {
    return `
      select
        event.id || ':job-rejected' as id,
        event.id as audit_event_id,
        event.tenant_id,
        'rejected-job-enqueue' as kind,
        'warning' as severity,
        event.action,
        event.user_id,
        event.user_role,
        event.resource_type,
        event.resource_id,
        'Background job enqueue rejected by policy' as message,
        event.metadata,
        event.created_at,
        acknowledgement.acknowledged_at,
        acknowledgement.acknowledged_by_user_id,
        acknowledgement.acknowledged_by_user_role,
        acknowledgement.note as acknowledgement_note
      from audit_events event
      left join security_event_acknowledgements acknowledgement
        on acknowledgement.tenant_id = event.tenant_id
        and acknowledgement.event_id = event.id || ':job-rejected'
      where event.tenant_id = $1
        and event.action = 'job.enqueue_rejected'

      union all

      select
        event.id || ':blocked-ai-action:' || coalesce(policy->>'action', 'unknown') as id,
        event.id as audit_event_id,
        event.tenant_id,
        'blocked-ai-action' as kind,
        case when policy->>'risk' = 'destructive' then 'critical' else 'warning' end as severity,
        event.action,
        event.user_id,
        event.user_role,
        event.resource_type,
        event.resource_id,
        'AI action blocked by policy' as message,
        jsonb_build_object(
          'blockedAction', policy->>'action',
          'risk', policy->>'risk',
          'reason', policy->>'reason',
          'decision', policy->>'decision'
        ) as metadata,
        event.created_at,
        acknowledgement.acknowledged_at,
        acknowledgement.acknowledged_by_user_id,
        acknowledgement.acknowledged_by_user_role,
        acknowledgement.note as acknowledgement_note
      from audit_events event
      cross join lateral jsonb_array_elements(coalesce(event.metadata->'actionPolicy', '[]'::jsonb)) policy
      left join security_event_acknowledgements acknowledgement
        on acknowledgement.tenant_id = event.tenant_id
        and acknowledgement.event_id = event.id || ':blocked-ai-action:' || coalesce(policy->>'action', 'unknown')
      where event.tenant_id = $1
        and event.action = 'property.ai_assistant'
        and policy->>'decision' = 'blocked'

      union all

      select
        event.id || ':image-delete-previewed' as id,
        event.id as audit_event_id,
        event.tenant_id,
        'image-delete-previewed' as kind,
        'info' as severity,
        event.action,
        event.user_id,
        event.user_role,
        event.resource_type,
        event.resource_id,
        'Image delete preview token created' as message,
        event.metadata,
        event.created_at,
        acknowledgement.acknowledged_at,
        acknowledgement.acknowledged_by_user_id,
        acknowledgement.acknowledged_by_user_role,
        acknowledgement.note as acknowledgement_note
      from audit_events event
      left join security_event_acknowledgements acknowledgement
        on acknowledgement.tenant_id = event.tenant_id
        and acknowledgement.event_id = event.id || ':image-delete-previewed'
      where event.tenant_id = $1
        and event.action = 'property.image_delete_previewed'

      union all

      select
        event.id || ':image-removed' as id,
        event.id as audit_event_id,
        event.tenant_id,
        'image-removed' as kind,
        'warning' as severity,
        event.action,
        event.user_id,
        event.user_role,
        event.resource_type,
        event.resource_id,
        'Property image removed after confirmation' as message,
        event.metadata,
        event.created_at,
        acknowledgement.acknowledged_at,
        acknowledgement.acknowledged_by_user_id,
        acknowledgement.acknowledged_by_user_role,
        acknowledgement.note as acknowledgement_note
      from audit_events event
      left join security_event_acknowledgements acknowledgement
        on acknowledgement.tenant_id = event.tenant_id
        and acknowledgement.event_id = event.id || ':image-removed'
      where event.tenant_id = $1
        and event.action = 'property.image_removed'
    `;
  }

  private securityEventFilters(
    tenantId: string,
    request: TenantSecurityEventsRequest
  ): { filterSql: string; values: unknown[] } {
    const filters: string[] = [];
    const values: unknown[] = [tenantId];
    const addValue = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (request.kind) {
      filters.push(`kind = ${addValue(request.kind)}`);
    }

    if (request.severity) {
      filters.push(`severity = ${addValue(request.severity)}`);
    }

    if (request.userId) {
      filters.push(`user_id = ${addValue(request.userId)}`);
    }

    if (request.acknowledgement === "acknowledged") {
      filters.push("acknowledged_at is not null");
    }

    if (request.acknowledgement === "unacknowledged") {
      filters.push("acknowledged_at is null");
    }

    return {
      filterSql: filters.length ? `where ${filters.join(" and ")}` : "",
      values
    };
  }

  private async count(sql: string, values: unknown[]): Promise<number> {
    const result = await this.pool.query<CountRow>(sql, values);
    return Number(result.rows[0]?.count ?? 0);
  }

  private async bucket(sql: string, values: unknown[]): Promise<CountByBucket[]> {
    const result = await this.pool.query<BucketRow>(sql, values);

    return result.rows.map((row) => ({
      bucket: row.bucket,
      count: Number(row.count)
    }));
  }

  private async average(sql: string, values: unknown[]): Promise<number> {
    const result = await this.pool.query<CountRow>(sql, values);
    return Math.round(Number(result.rows[0]?.count ?? 0));
  }

  private async leadSlaMetrics(tenantId: string): Promise<{
    responseBreached: number;
    responseDueSoon: number;
    unassignedBreached: number;
    overdueFollowUps: number;
    averageFirstResponseHours?: number;
  }> {
    const result = await this.pool.query<LeadSlaMetricsRow>(
      `
        with first_response as (
          select
            lead_id,
            min(created_at) as first_response_at
          from lead_status_events
          where tenant_id = $1
            and previous_status = 'new'
            and status in ('contacted', 'qualified', 'lost', 'won')
          group by lead_id
        )
        select
          count(*) filter (
            where lead.status = 'new'
              and lead.created_at <= now() - interval '4 hours'
          ) as response_breached,
          count(*) filter (
            where lead.status = 'new'
              and lead.created_at <= now() - interval '3 hours'
              and lead.created_at > now() - interval '4 hours'
          ) as response_due_soon,
          count(*) filter (
            where lead.status = 'new'
              and lead.assigned_agent_id is null
              and lead.created_at <= now() - interval '4 hours'
          ) as unassigned_breached,
          count(*) filter (
            where lead.status in ('new', 'contacted', 'qualified')
              and lead.next_follow_up_at is not null
              and lead.next_follow_up_at < now()
          ) as overdue_follow_ups,
          avg(extract(epoch from (response.first_response_at - lead.created_at)) / 3600)
            filter (where response.first_response_at is not null) as average_first_response_hours
        from leads lead
        left join first_response response on response.lead_id = lead.id
        where lead.tenant_id = $1
      `,
      [tenantId]
    );
    const row = result.rows[0];
    const averageFirstResponseHours =
      row.average_first_response_hours === null ? undefined : Number(row.average_first_response_hours);

    return {
      responseBreached: Number(row.response_breached),
      responseDueSoon: Number(row.response_due_soon),
      unassignedBreached: Number(row.unassigned_breached),
      overdueFollowUps: Number(row.overdue_follow_ups),
      averageFirstResponseHours:
        averageFirstResponseHours === undefined ? undefined : Number(averageFirstResponseHours.toFixed(2))
    };
  }

  private toSecurityEvent(row: SecurityEventRow): TenantSecurityEventSnapshot {
    return {
      id: row.id,
      auditEventId: row.audit_event_id,
      tenantId: row.tenant_id,
      kind: row.kind,
      severity: row.severity,
      action: row.action,
      userId: row.user_id ?? undefined,
      userRole: row.user_role ?? undefined,
      resourceType: row.resource_type,
      resourceId: row.resource_id ?? undefined,
      message: row.message,
      metadata: row.metadata,
      acknowledgedAt: row.acknowledged_at?.toISOString(),
      acknowledgedByUserId: row.acknowledged_by_user_id ?? undefined,
      acknowledgedByUserRole: row.acknowledged_by_user_role ?? undefined,
      acknowledgementNote: row.acknowledgement_note ?? undefined,
      createdAt: row.created_at.toISOString()
    };
  }
}
