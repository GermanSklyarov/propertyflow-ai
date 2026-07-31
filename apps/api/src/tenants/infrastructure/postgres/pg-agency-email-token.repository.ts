import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type {
  AgencyEmailTokenPurpose,
  AgencyEmailTokenRecord,
  AgencyEmailTokenRepository,
  CreateAgencyEmailTokenInput
} from "../../domain/agency-email-token.repository.js";

interface AgencyEmailTokenRow {
  id: string;
  tenant_id: string;
  email: string;
  purpose: AgencyEmailTokenPurpose;
  token_hash: string;
  metadata: Record<string, unknown> | null;
  expires_at: Date;
  consumed_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

@Injectable()
export class PgAgencyEmailTokenRepository implements AgencyEmailTokenRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(input: CreateAgencyEmailTokenInput): Promise<AgencyEmailTokenRecord> {
    const result = await this.pool.query<AgencyEmailTokenRow>(
      `
        insert into agency_email_tokens (
          id,
          tenant_id,
          email,
          purpose,
          token_hash,
          metadata,
          expires_at,
          created_at
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        )
        returning *
      `,
      [
        input.id,
        input.tenantId,
        input.email,
        input.purpose,
        input.tokenHash,
        input.metadata,
        input.expiresAt,
        input.createdAt
      ]
    );

    return toRecord(result.rows[0]);
  }

  async findUsableByHash(tokenHash: string, now: Date): Promise<AgencyEmailTokenRecord | null> {
    const result = await this.pool.query<AgencyEmailTokenRow>(
      `
        select *
        from agency_email_tokens
        where token_hash = $1
          and consumed_at is null
          and revoked_at is null
          and expires_at > $2
        limit 1
      `,
      [tokenHash, now]
    );

    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async consume(tokenId: string, consumedAt: Date): Promise<AgencyEmailTokenRecord | null> {
    const result = await this.pool.query<AgencyEmailTokenRow>(
      `
        update agency_email_tokens
        set consumed_at = $1
        where id = $2
          and consumed_at is null
          and revoked_at is null
        returning *
      `,
      [consumedAt, tokenId]
    );

    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async revokeActiveForEmail(
    tenantId: string,
    email: string,
    purpose: AgencyEmailTokenPurpose,
    revokedAt: Date
  ): Promise<number> {
    const result = await this.pool.query(
      `
        update agency_email_tokens
        set revoked_at = $4
        where tenant_id = $1
          and lower(email) = lower($2)
          and purpose = $3
          and consumed_at is null
          and revoked_at is null
      `,
      [tenantId, email, purpose, revokedAt]
    );

    return result.rowCount ?? 0;
  }
}

function toRecord(row: AgencyEmailTokenRow): AgencyEmailTokenRecord {
  return {
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
    email: row.email,
    expiresAt: row.expires_at,
    id: row.id,
    metadata: row.metadata ?? {},
    purpose: row.purpose,
    revokedAt: row.revoked_at,
    tenantId: row.tenant_id,
    tokenHash: row.token_hash
  };
}
