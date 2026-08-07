import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type {
  ConsumeNotificationConnectionTokenInput,
  CreateNotificationConnectionTokenInput,
  NotificationConnectionTokenRecord,
  NotificationConnectionTokenRepository
} from "../../domain/notification-connection-token.repository.js";
import type { TenantNotificationProvider } from "@propertyflow/contracts";

interface NotificationConnectionTokenRow {
  code: string;
  consumed_at: Date | null;
  created_at: Date;
  expires_at: Date;
  id: string;
  provider: TenantNotificationProvider;
  recipient_id: string | null;
  recipient_label: string | null;
  tenant_id: string;
}

@Injectable()
export class PgNotificationConnectionTokenRepository implements NotificationConnectionTokenRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(input: CreateNotificationConnectionTokenInput): Promise<NotificationConnectionTokenRecord> {
    const result = await this.pool.query<NotificationConnectionTokenRow>(
      `
        insert into notification_connection_tokens (
          id,
          tenant_id,
          provider,
          code,
          expires_at,
          created_at
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
        returning *
      `,
      [input.id, input.tenantId, input.provider, input.code, input.expiresAt, input.createdAt]
    );

    return toRecord(result.rows[0]);
  }

  async consume(input: ConsumeNotificationConnectionTokenInput): Promise<NotificationConnectionTokenRecord | null> {
    const result = await this.pool.query<NotificationConnectionTokenRow>(
      `
        update notification_connection_tokens
        set
          consumed_at = $4,
          recipient_id = $5,
          recipient_label = $6
        where code = $1
          and provider = $2
          and consumed_at is null
          and expires_at > $3
        returning *
      `,
      [input.code, input.provider, input.consumedAt, input.consumedAt, input.recipientId, input.recipientLabel ?? null]
    );

    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async revokeActiveForTenantProvider(
    tenantId: string,
    provider: TenantNotificationProvider,
    revokedAt: Date
  ): Promise<number> {
    const result = await this.pool.query(
      `
        update notification_connection_tokens
        set consumed_at = $4
        where tenant_id = $1
          and provider = $2
          and consumed_at is null
          and expires_at > $3
      `,
      [tenantId, provider, revokedAt, revokedAt]
    );

    return result.rowCount ?? 0;
  }
}

function toRecord(row: NotificationConnectionTokenRow): NotificationConnectionTokenRecord {
  return {
    code: row.code,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    provider: row.provider,
    recipientId: row.recipient_id,
    recipientLabel: row.recipient_label,
    tenantId: row.tenant_id
  };
}
