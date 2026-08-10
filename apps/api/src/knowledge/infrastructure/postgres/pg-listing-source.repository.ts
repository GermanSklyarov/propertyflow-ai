import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateListingSourceRequest,
  ListingSourceAuthType,
  ListingSourceFieldMapping,
  ListingSourceImportMode,
  ListingSourceSnapshot,
  ListingSourceStatus,
  ListingSourceSyncInterval,
  ListingSourceType
} from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { ListingSourceRepository } from "../../domain/listing-source.repository.js";

interface ListingSourceRow {
  id: string;
  tenant_id: string;
  name: string;
  type: ListingSourceType;
  endpoint_url: string;
  auth_type: ListingSourceAuthType;
  auth_header_name: string | null;
  auth_secret_ref: string | null;
  import_mode: ListingSourceImportMode;
  mapping: ListingSourceFieldMapping;
  status: ListingSourceStatus;
  sync_interval: ListingSourceSyncInterval;
  next_sync_at: Date | null;
  last_sync_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PgListingSourceRepository implements ListingSourceRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async save(tenantId: string, request: CreateListingSourceRequest): Promise<ListingSourceSnapshot> {
    const now = new Date().toISOString();
    const result = await this.pool.query<ListingSourceRow>(
      `
        insert into listing_source_configs (
          id,
          tenant_id,
          name,
          type,
          endpoint_url,
          auth_type,
          auth_header_name,
          auth_secret_ref,
          import_mode,
          mapping,
          status,
          sync_interval,
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
          $12,
          $13,
          $14
        )
        returning *
      `,
      [
        crypto.randomUUID(),
        tenantId,
        request.name,
        request.type ?? "rest-api",
        request.endpointUrl,
        request.authType ?? "none",
        request.authHeaderName ?? null,
        request.authSecretRef ?? null,
        request.importMode ?? "hybrid",
        request.mapping,
        "draft",
        request.syncInterval ?? "disabled",
        now,
        now
      ]
    );

    return this.toSnapshot(result.rows[0]);
  }

  async list(tenantId: string): Promise<ListingSourceSnapshot[]> {
    const result = await this.pool.query<ListingSourceRow>(
      `
        select *
        from listing_source_configs
        where tenant_id = $1
        order by updated_at desc
      `,
      [tenantId]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  async findById(tenantId: string, sourceId: string): Promise<ListingSourceSnapshot | null> {
    const result = await this.pool.query<ListingSourceRow>(
      `
        select *
        from listing_source_configs
        where tenant_id = $1 and id = $2
        limit 1
      `,
      [tenantId, sourceId]
    );

    const row = result.rows[0];
    return row ? this.toSnapshot(row) : null;
  }

  async markSyncStarted(tenantId: string, sourceId: string): Promise<ListingSourceSnapshot | null> {
    const now = new Date().toISOString();
    const result = await this.pool.query<ListingSourceRow>(
      `
        update listing_source_configs
        set
          status = 'syncing',
          last_error = null,
          updated_at = $3
        where tenant_id = $1 and id = $2
        returning *
      `,
      [tenantId, sourceId, now]
    );

    const row = result.rows[0];
    return row ? this.toSnapshot(row) : null;
  }

  async markSyncFailed(tenantId: string, sourceId: string, reason: string): Promise<ListingSourceSnapshot | null> {
    const now = new Date().toISOString();
    const result = await this.pool.query<ListingSourceRow>(
      `
        update listing_source_configs
        set
          status = 'failed',
          last_error = $3,
          updated_at = $4
        where tenant_id = $1 and id = $2
        returning *
      `,
      [tenantId, sourceId, reason, now]
    );

    const row = result.rows[0];
    return row ? this.toSnapshot(row) : null;
  }

  async updateSchedule(
    tenantId: string,
    sourceId: string,
    syncInterval: ListingSourceSyncInterval,
    nextSyncAt?: Date
  ): Promise<ListingSourceSnapshot | null> {
    const now = new Date().toISOString();
    const result = await this.pool.query<ListingSourceRow>(
      `
        update listing_source_configs
        set
          sync_interval = $3,
          next_sync_at = $4,
          updated_at = $5
        where tenant_id = $1 and id = $2
        returning *
      `,
      [tenantId, sourceId, syncInterval, nextSyncAt?.toISOString() ?? null, now]
    );

    const row = result.rows[0];
    return row ? this.toSnapshot(row) : null;
  }

  private toSnapshot(row: ListingSourceRow): ListingSourceSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      type: row.type,
      endpointUrl: row.endpoint_url,
      authType: row.auth_type,
      authHeaderName: row.auth_header_name ?? undefined,
      authSecretRef: row.auth_secret_ref ?? undefined,
      importMode: row.import_mode,
      mapping: row.mapping,
      status: row.status,
      syncInterval: row.sync_interval ?? "disabled",
      nextSyncAt: row.next_sync_at?.toISOString(),
      lastSyncAt: row.last_sync_at?.toISOString(),
      lastError: row.last_error ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }
}
