import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { RecordSearchEventInput, SearchEventRepository } from "../../domain/search-event.repository.js";

@Injectable()
export class PgSearchEventRepository implements SearchEventRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async record(input: RecordSearchEventInput): Promise<void> {
    await this.pool.query(
      `
        insert into search_events (
          id,
          tenant_id,
          user_id,
          user_role,
          source,
          query,
          filters,
          total_results,
          latency_ms,
          created_at
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
          $10
        )
      `,
      [
        crypto.randomUUID(),
        input.tenantId,
        input.user?.id ?? null,
        input.user?.role ?? null,
        input.source,
        input.query ?? null,
        JSON.stringify(input.filters),
        input.totalResults,
        input.latencyMs,
        new Date().toISOString()
      ]
    );
  }
}
