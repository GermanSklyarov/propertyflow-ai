import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type {
  AgencyRefreshTokenRecord,
  AgencyRefreshTokenRepository,
  CreateAgencyRefreshTokenInput
} from "../../domain/agency-refresh-token.repository.js";

interface AgencyRefreshTokenRow {
  id: string;
  tenant_id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_token_id: string | null;
  created_at: Date;
}

@Injectable()
export class PgAgencyRefreshTokenRepository implements AgencyRefreshTokenRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(input: CreateAgencyRefreshTokenInput): Promise<AgencyRefreshTokenRecord> {
    const result = await this.pool.query<AgencyRefreshTokenRow>(
      `
        insert into agency_refresh_tokens (
          id,
          tenant_id,
          user_id,
          token_hash,
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
      [input.id, input.tenantId, input.userId, input.tokenHash, input.expiresAt, input.createdAt]
    );

    return toRecord(result.rows[0]);
  }

  async findActiveByHash(tokenHash: string, now: Date): Promise<AgencyRefreshTokenRecord | null> {
    const result = await this.pool.query<AgencyRefreshTokenRow>(
      `
        select *
        from agency_refresh_tokens
        where token_hash = $1
          and revoked_at is null
          and expires_at > $2
        limit 1
      `,
      [tokenHash, now]
    );

    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  async revoke(currentTokenId: string, revokedAt: Date): Promise<boolean> {
    const result = await this.pool.query(
      `
        update agency_refresh_tokens
        set revoked_at = $1
        where id = $2
          and revoked_at is null
      `,
      [revokedAt, currentTokenId]
    );

    return Boolean(result.rowCount);
  }

  async rotate(currentTokenId: string, input: CreateAgencyRefreshTokenInput): Promise<AgencyRefreshTokenRecord | null> {
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      const created = await client.query<AgencyRefreshTokenRow>(
        `
          insert into agency_refresh_tokens (
            id,
            tenant_id,
            user_id,
            token_hash,
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
        [input.id, input.tenantId, input.userId, input.tokenHash, input.expiresAt, input.createdAt]
      );
      const revoked = await client.query(
        `
          update agency_refresh_tokens
          set revoked_at = $1,
              replaced_by_token_id = $2
          where id = $3
            and revoked_at is null
        `,
        [input.createdAt, input.id, currentTokenId]
      );

      if (!revoked.rowCount) {
        await client.query("rollback");

        return null;
      }

      await client.query("commit");

      return toRecord(created.rows[0]);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

function toRecord(row: AgencyRefreshTokenRow): AgencyRefreshTokenRecord {
  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    replacedByTokenId: row.replaced_by_token_id,
    revokedAt: row.revoked_at,
    tenantId: row.tenant_id,
    tokenHash: row.token_hash,
    userId: row.user_id
  };
}
