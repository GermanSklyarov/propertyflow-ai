import { Inject, Injectable } from "@nestjs/common";
import type { AuditEventSnapshot } from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { AuditRepository, RecordAuditEventInput } from "../../domain/audit.repository.js";

interface AuditEventRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  user_role: AuditEventSnapshot["userRole"] | null;
  action: AuditEventSnapshot["action"];
  resource_type: AuditEventSnapshot["resourceType"];
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

@Injectable()
export class PgAuditRepository implements AuditRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async record(input: RecordAuditEventInput): Promise<AuditEventSnapshot> {
    const result = await this.pool.query<AuditEventRow>(
      `
        insert into audit_events (
          id,
          tenant_id,
          user_id,
          user_role,
          action,
          resource_type,
          resource_id,
          metadata,
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
        returning *
      `,
      [
        crypto.randomUUID(),
        input.tenantId,
        input.userId ?? null,
        input.userRole ?? null,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        JSON.stringify(input.metadata ?? {}),
        new Date().toISOString()
      ]
    );

    return this.toSnapshot(result.rows[0]);
  }

  private toSnapshot(row: AuditEventRow): AuditEventSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id ?? undefined,
      userRole: row.user_role ?? undefined,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id ?? undefined,
      metadata: row.metadata,
      createdAt: row.created_at.toISOString()
    };
  }
}

