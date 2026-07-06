import { Inject, Injectable } from "@nestjs/common";
import type { CountByBucket } from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { AnalyticsRepository, TenantAnalyticsRawMetrics } from "../../domain/analytics.repository.js";

interface CountRow {
  count: string;
}

interface BucketRow {
  bucket: string;
  count: string;
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
}
