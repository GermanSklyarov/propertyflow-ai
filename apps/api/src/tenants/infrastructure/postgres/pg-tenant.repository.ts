import { Inject, Injectable } from "@nestjs/common";
import type { TenantSnapshot, UpdateTenantSettingsRequest } from "@propertyflow/contracts";
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
  custom_domain: string | null;
  domain_status: TenantSnapshot["domainStatus"];
  subscription_plan: TenantSnapshot["subscriptionPlan"];
  limits: TenantSnapshot["limits"];
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

  async updateSettings(tenantId: string, request: UpdateTenantSettingsRequest): Promise<TenantSnapshot | null> {
    const current = await this.findById(tenantId);

    if (!current) {
      return null;
    }

    const customDomain = request.customDomain?.trim() || undefined;
    const result = await this.pool.query<TenantRow>(
      `
        update tenants
        set
          primary_market = $2,
          custom_domain = $3,
          domain_status = $4,
          branding_display_name = $5,
          branding_primary_color = $6,
          branding_logo_url = $7,
          updated_at = $8
        where id = $1
        returning *
      `,
      [
        tenantId,
        request.primaryMarket ?? current.primaryMarket ?? null,
        customDomain ?? current.customDomain ?? null,
        customDomain && customDomain !== current.customDomain ? "pending-verification" : current.domainStatus ?? "not-configured",
        request.branding?.displayName ?? current.branding.displayName,
        request.branding?.primaryColor ?? current.branding.primaryColor ?? null,
        request.branding?.logoUrl ?? current.branding.logoUrl ?? null,
        new Date().toISOString()
      ]
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
      customDomain: row.custom_domain ?? undefined,
      domainStatus: row.domain_status,
      subscriptionPlan: row.subscription_plan,
      limits: row.limits,
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
