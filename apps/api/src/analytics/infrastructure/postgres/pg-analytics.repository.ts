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
      topLeadSearchQueries
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
      topLeadSearchQueries
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
