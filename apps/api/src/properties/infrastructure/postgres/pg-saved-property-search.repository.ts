import { Inject, Injectable } from "@nestjs/common";
import type { PropertySearchRequest, SavedPropertySearchSnapshot } from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type {
  SavedPropertySearchLeadFunnelRow,
  SavedPropertySearchRepository,
  SavePropertySearchInput
} from "../../domain/saved-property-search.repository.js";

interface SavedPropertySearchRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  title: string;
  natural_language_query: string | null;
  locale: SavedPropertySearchSnapshot["locale"] | null;
  purpose: SavedPropertySearchSnapshot["purpose"] | null;
  filters: PropertySearchRequest;
  match_count: number;
  notifications_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

interface SavedPropertySearchLeadFunnelSqlRow extends SavedPropertySearchRow {
  lead_count: string;
  latest_lead_at: Date | null;
}

@Injectable()
export class PgSavedPropertySearchRepository implements SavedPropertySearchRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async save(input: SavePropertySearchInput): Promise<SavedPropertySearchSnapshot> {
    const now = new Date().toISOString();
    const result = await this.pool.query<SavedPropertySearchRow>(
      `
        insert into saved_property_searches (
          id,
          tenant_id,
          user_id,
          title,
          natural_language_query,
          locale,
          purpose,
          filters,
          match_count,
          notifications_enabled,
          created_at,
          updated_at
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12
        )
        returning *
      `,
      [
        crypto.randomUUID(),
        input.tenantId,
        input.userId ?? null,
        input.title,
        input.naturalLanguageQuery ?? null,
        input.locale ?? null,
        input.purpose ?? null,
        JSON.stringify(input.filters),
        input.matchCount,
        input.notificationsEnabled,
        now,
        now
      ]
    );

    return this.toSnapshot(result.rows[0]);
  }

  async list(tenantId: string, userId?: string): Promise<SavedPropertySearchSnapshot[]> {
    const values: unknown[] = [tenantId];
    const userFilter = userId ? "and user_id = $2" : "";

    if (userId) {
      values.push(userId);
    }

    const result = await this.pool.query<SavedPropertySearchRow>(
      `
        select *
        from saved_property_searches
        where tenant_id = $1
          ${userFilter}
        order by created_at desc
      `,
      values
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  async listLeadFunnel(tenantId: string, userId?: string): Promise<SavedPropertySearchLeadFunnelRow[]> {
    const values: unknown[] = [tenantId];
    const userFilter = userId ? "and search.user_id = $2" : "";

    if (userId) {
      values.push(userId);
    }

    const result = await this.pool.query<SavedPropertySearchLeadFunnelSqlRow>(
      `
        select
          search.*,
          count(lead.id) as lead_count,
          max(lead.created_at) as latest_lead_at
        from saved_property_searches search
        left join leads lead
          on lead.tenant_id = search.tenant_id
          and lead.source = 'saved-search'
          and lead.attribution_search_event_id = search.id
        where search.tenant_id = $1
          ${userFilter}
        group by search.id
        order by count(lead.id) desc, max(lead.created_at) desc nulls last, search.created_at desc
      `,
      values
    );

    return result.rows.map((row) => ({
      savedSearch: this.toSnapshot(row),
      leadCount: Number(row.lead_count),
      latestLeadAt: row.latest_lead_at?.toISOString()
    }));
  }

  async findById(tenantId: string, searchId: string): Promise<SavedPropertySearchSnapshot | null> {
    const result = await this.pool.query<SavedPropertySearchRow>(
      `
        select *
        from saved_property_searches
        where tenant_id = $1 and id = $2
      `,
      [tenantId, searchId]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async updateNotifications(
    tenantId: string,
    searchId: string,
    notificationsEnabled: boolean
  ): Promise<SavedPropertySearchSnapshot | null> {
    const result = await this.pool.query<SavedPropertySearchRow>(
      `
        update saved_property_searches
        set notifications_enabled = $3,
            updated_at = $4
        where tenant_id = $1 and id = $2
        returning *
      `,
      [tenantId, searchId, notificationsEnabled, new Date().toISOString()]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async delete(tenantId: string, searchId: string): Promise<SavedPropertySearchSnapshot | null> {
    const result = await this.pool.query<SavedPropertySearchRow>(
      `
        delete from saved_property_searches
        where tenant_id = $1 and id = $2
        returning *
      `,
      [tenantId, searchId]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  private toSnapshot(row: SavedPropertySearchRow): SavedPropertySearchSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id ?? undefined,
      title: row.title,
      naturalLanguageQuery: row.natural_language_query ?? undefined,
      locale: row.locale ?? undefined,
      purpose: row.purpose ?? undefined,
      filters: row.filters,
      matchCount: row.match_count,
      notificationsEnabled: row.notifications_enabled,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }
}
