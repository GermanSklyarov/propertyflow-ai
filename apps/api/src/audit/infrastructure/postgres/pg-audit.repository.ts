import { Inject, Injectable } from "@nestjs/common";
import type { AuditEventSnapshot, ListAuditEventsRequest } from "@propertyflow/contracts";
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

  async list(tenantId: string, request: ListAuditEventsRequest): Promise<AuditEventSnapshot[]> {
    const clauses = ["tenant_id = $1"];
    const values: unknown[] = [tenantId];
    const limit = Math.min(Math.max(request.limit ?? 50, 1), 100);
    const addValue = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (request.action) {
      clauses.push(`action = ${addValue(request.action)}`);
    }

    if (request.resourceType) {
      clauses.push(`resource_type = ${addValue(request.resourceType)}`);
    }

    if (request.resourceId) {
      clauses.push(`resource_id = ${addValue(request.resourceId)}`);
    }

    if (request.userId) {
      clauses.push(`user_id = ${addValue(request.userId)}`);
    }

    const result = await this.pool.query<AuditEventRow>(
      `
        select *
        from audit_events
        where ${clauses.join(" and ")}
        order by created_at desc
        limit ${addValue(limit)}
      `,
      values
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

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
