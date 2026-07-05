import { Inject, Injectable } from "@nestjs/common";
import type { PropertyStatusEventSnapshot } from "@propertyflow/contracts";
import type { PropertyStatus } from "@propertyflow/domain";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type {
  PropertyStatusHistoryRepository,
  RecordPropertyStatusEventInput
} from "../../domain/property-status-history.repository.js";

interface PropertyStatusEventRow {
  id: string;
  tenant_id: string;
  property_id: string;
  previous_status: PropertyStatus;
  status: PropertyStatus;
  changed_by_user_id: string | null;
  changed_by_user_role: PropertyStatusEventSnapshot["changedByUserRole"] | null;
  note: string | null;
  created_at: Date;
}

@Injectable()
export class PgPropertyStatusHistoryRepository implements PropertyStatusHistoryRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async record(input: RecordPropertyStatusEventInput): Promise<PropertyStatusEventSnapshot> {
    const result = await this.pool.query<PropertyStatusEventRow>(
      `
        insert into property_status_events (
          id,
          tenant_id,
          property_id,
          previous_status,
          status,
          changed_by_user_id,
          changed_by_user_role,
          note,
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
          $9
        )
        returning id, tenant_id, property_id, previous_status, status, changed_by_user_id, changed_by_user_role, note, created_at
      `,
      [
        crypto.randomUUID(),
        input.tenantId,
        input.propertyId,
        input.previousStatus,
        input.status,
        input.user.id,
        input.user.role,
        input.note ?? null,
        new Date().toISOString()
      ]
    );

    return this.toSnapshot(result.rows[0]);
  }

  async listByPropertyId(tenantId: string, propertyId: string): Promise<PropertyStatusEventSnapshot[]> {
    const result = await this.pool.query<PropertyStatusEventRow>(
      `
        select id, tenant_id, property_id, previous_status, status, changed_by_user_id, changed_by_user_role, note, created_at
        from property_status_events
        where tenant_id = $1 and property_id = $2
        order by created_at asc
      `,
      [tenantId, propertyId]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  private toSnapshot(row: PropertyStatusEventRow): PropertyStatusEventSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      previousStatus: row.previous_status,
      status: row.status,
      changedByUserId: row.changed_by_user_id ?? undefined,
      changedByUserRole: row.changed_by_user_role ?? undefined,
      note: row.note ?? undefined,
      createdAt: row.created_at.toISOString()
    };
  }
}
