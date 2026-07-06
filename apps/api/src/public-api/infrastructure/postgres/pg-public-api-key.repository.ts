import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { PublicApiKeySnapshot } from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { PublicApiKeyRepository, PublicApiMonthlyUsage } from "../../domain/public-api-key.repository.js";

interface PublicApiKeyRow {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  status: PublicApiKeySnapshot["status"];
  scopes: string[];
  created_at: Date;
  last_used_at: Date | null;
}

interface PublicApiUsageRow {
  used: string;
  monthly_limit: string;
}

@Injectable()
export class PgPublicApiKeyRepository implements PublicApiKeyRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findActiveByHash(keyHash: string): Promise<PublicApiKeySnapshot | null> {
    const result = await this.pool.query<PublicApiKeyRow>(
      `
        select id, tenant_id, name, key_prefix, status, scopes, created_at, last_used_at
        from api_keys
        where key_hash = $1 and status = 'active'
        limit 1
      `,
      [keyHash]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async markUsed(apiKeyId: string): Promise<void> {
    await this.pool.query(
      `
        update api_keys
        set last_used_at = now()
        where id = $1
      `,
      [apiKeyId]
    );
  }

  async getPublicApiMonthlyUsage(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<PublicApiMonthlyUsage> {
    const result = await this.pool.query<PublicApiUsageRow>(
      `
        select
          coalesce(sum(event.quantity), 0) as used,
          coalesce((tenant.limits->>'publicApiRequestsMonthly')::integer, 0) as monthly_limit
        from tenants tenant
        left join tenant_usage_events event
          on event.tenant_id = tenant.id
          and event.event_type = 'public-api.request'
          and event.created_at >= $2
          and event.created_at < $3
        where tenant.id = $1
        group by tenant.limits
      `,
      [tenantId, periodStart.toISOString(), periodEnd.toISOString()]
    );

    return {
      used: Number(result.rows[0]?.used ?? 0),
      limit: Number(result.rows[0]?.monthly_limit ?? 0)
    };
  }

  async recordUsage(tenantId: string, apiKeyId: string, route: string): Promise<void> {
    await this.pool.query(
      `
        insert into tenant_usage_events (
          id,
          tenant_id,
          event_type,
          quantity,
          metadata,
          created_at
        ) values (
          $1,
          $2,
          'public-api.request',
          1,
          $3,
          $4
        )
      `,
      [
        randomUUID(),
        tenantId,
        JSON.stringify({
          apiKeyId,
          route
        }),
        new Date().toISOString()
      ]
    );
  }

  private toSnapshot(row: PublicApiKeyRow): PublicApiKeySnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      status: row.status,
      scopes: row.scopes,
      createdAt: row.created_at.toISOString(),
      lastUsedAt: row.last_used_at?.toISOString()
    };
  }
}
