import { Inject, Injectable } from "@nestjs/common";
import type { TenantSnapshot } from "@propertyflow/contracts";
import type { Pool } from "pg";
import type { ThailandMarket } from "@propertyflow/domain";
import { PG_POOL } from "../../../database/database.constants.js";
import type { TenantRepository } from "../../domain/tenant.repository.js";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: TenantSnapshot["status"];
  primary_market: ThailandMarket | null;
  branding_display_name: string;
  branding_primary_color: string | null;
  branding_logo_url: string | null;
  created_at: Date;
  updated_at: Date;
}

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

  private toSnapshot(row: TenantRow): TenantSnapshot {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      primaryMarket: row.primary_market ?? undefined,
      branding: {
        displayName: row.branding_display_name,
        primaryColor: row.branding_primary_color ?? undefined,
        logoUrl: row.branding_logo_url ?? undefined
      },
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }
}

