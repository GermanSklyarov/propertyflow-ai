import { Inject, Injectable } from "@nestjs/common";
import type { LeadSnapshot } from "@propertyflow/contracts";
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
          $12
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
        now,
        now
      ]
    );

    return this.toSnapshot(result.rows[0]);
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
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }
}

