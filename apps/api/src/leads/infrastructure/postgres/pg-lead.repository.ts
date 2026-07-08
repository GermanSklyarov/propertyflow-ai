import { Inject, Injectable } from "@nestjs/common";
import type { LeadSnapshot, LeadStatus } from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { CreateLeadInput, LeadRepository } from "../../domain/lead.repository.js";

interface LeadRow {
  id: string;
  tenant_id: string;
  property_id: string | null;
  source: LeadSnapshot["source"];
  status: LeadSnapshot["status"];
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  message: string | null;
  preferred_locale: LeadSnapshot["preferredLocale"] | null;
  assigned_agent_id: string | null;
  attribution_search_event_id: string | null;
  attribution_search_query: string | null;
  attribution_search_source: LeadSnapshot["attributionSearchSource"] | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PgLeadRepository implements LeadRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(input: CreateLeadInput): Promise<LeadSnapshot> {
    const now = new Date().toISOString();
    const result = await this.pool.query<LeadRow>(
      `
        insert into leads (
          id,
          tenant_id,
          property_id,
          source,
          status,
          contact_name,
          contact_email,
          contact_phone,
          message,
          preferred_locale,
          assigned_agent_id,
          attribution_search_event_id,
          attribution_search_query,
          attribution_search_source,
          created_at,
          updated_at
        ) values (
          $1,
          $2,
          $3,
          $4,
          'new',
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15
        )
        returning *
      `,
      [
        crypto.randomUUID(),
        input.tenantId,
        input.propertyId ?? null,
        input.source,
        input.contactName,
        input.contactEmail ?? null,
        input.contactPhone ?? null,
        input.message ?? null,
        input.preferredLocale ?? null,
        input.assignedAgentId ?? null,
        input.attributionSearchEventId ?? null,
        input.attributionSearchQuery ?? null,
        input.attributionSearchSource ?? null,
        now,
        now
      ]
    );

    return this.toSnapshot(result.rows[0]);
  }

  async listUnassigned(tenantId: string): Promise<LeadSnapshot[]> {
    const result = await this.pool.query<LeadRow>(
      `
        select *
        from leads
        where tenant_id = $1
          and assigned_agent_id is null
          and status in ('new', 'contacted', 'qualified')
        order by created_at desc
      `,
      [tenantId]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  async listByAttribution(tenantId: string, attributionSearchEventId: string): Promise<LeadSnapshot[]> {
    const result = await this.pool.query<LeadRow>(
      `
        select *
        from leads
        where tenant_id = $1
          and attribution_search_event_id = $2
        order by created_at desc
      `,
      [tenantId, attributionSearchEventId]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  async assign(tenantId: string, leadId: string, assignedAgentId: string): Promise<LeadSnapshot | null> {
    const result = await this.pool.query<LeadRow>(
      `
        update leads
        set assigned_agent_id = $3,
            updated_at = $4
        where tenant_id = $1 and id = $2
        returning *
      `,
      [tenantId, leadId, assignedAgentId, new Date().toISOString()]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async updateStatus(tenantId: string, leadId: string, status: LeadStatus): Promise<LeadSnapshot | null> {
    const result = await this.pool.query<LeadRow>(
      `
        update leads
        set status = $3,
            updated_at = $4
        where tenant_id = $1 and id = $2
        returning *
      `,
      [tenantId, leadId, status, new Date().toISOString()]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  private toSnapshot(row: LeadRow): LeadSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id ?? undefined,
      source: row.source,
      status: row.status,
      contactName: row.contact_name,
      contactEmail: row.contact_email ?? undefined,
      contactPhone: row.contact_phone ?? undefined,
      message: row.message ?? undefined,
      preferredLocale: row.preferred_locale ?? undefined,
      assignedAgentId: row.assigned_agent_id ?? undefined,
      attributionSearchEventId: row.attribution_search_event_id ?? undefined,
      attributionSearchQuery: row.attribution_search_query ?? undefined,
      attributionSearchSource: row.attribution_search_source ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }
}
