import { Inject, Injectable } from "@nestjs/common";
import type { SavedSearchAlertRunItem, SavedSearchAlertRunSnapshot } from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type {
  ListSavedSearchAlertRunsRequest,
  SavedSearchAlertRunRepository
} from "../../domain/saved-search-alert-run.repository.js";

interface SavedSearchAlertRunRow {
  id: string;
  tenant_id: string;
  requested_by_user_id: string | null;
  scope: SavedSearchAlertRunSnapshot["scope"];
  user_id: string | null;
  dry_run: boolean;
  status: SavedSearchAlertRunSnapshot["status"];
  total_alerts: number;
  total_candidates: number;
  items: SavedSearchAlertRunItem[];
  created_at: Date;
}

@Injectable()
export class PgSavedSearchAlertRunRepository implements SavedSearchAlertRunRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list(request: ListSavedSearchAlertRunsRequest): Promise<SavedSearchAlertRunSnapshot[]> {
    const values: unknown[] = [request.tenantId];
    const clauses = ["tenant_id = $1"];
    const addValue = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (request.userId) {
      clauses.push(`user_id = ${addValue(request.userId)}`);
    }

    const boundedLimit = Math.min(Math.max(request.limit ?? 20, 1), 100);
    const result = await this.pool.query<SavedSearchAlertRunRow>(
      `
        select *
        from saved_search_alert_runs
        where ${clauses.join(" and ")}
        order by created_at desc
        limit ${addValue(boundedLimit)}
      `,
      values
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  private toSnapshot(row: SavedSearchAlertRunRow): SavedSearchAlertRunSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      requestedByUserId: row.requested_by_user_id ?? undefined,
      scope: row.scope,
      userId: row.user_id ?? undefined,
      dryRun: row.dry_run,
      status: row.status,
      totalAlerts: row.total_alerts,
      totalCandidates: row.total_candidates,
      items: row.items,
      createdAt: row.created_at.toISOString()
    };
  }
}
