import { Inject, Injectable } from "@nestjs/common";
import type { TenantUserSnapshot, UserRole } from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { UserRepository } from "../../domain/user.repository.js";

interface TenantUserRow {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: UserRole;
  status: TenantUserSnapshot["status"];
  created_at: Date;
}

@Injectable()
export class PgUserRepository implements UserRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findById(tenantId: string, userId: string): Promise<TenantUserSnapshot | null> {
    const result = await this.pool.query<TenantUserRow>(
      `
        select *
        from tenant_users
        where tenant_id = $1 and id = $2
        limit 1
      `,
      [tenantId, userId]
    );

    return result.rows[0] ? this.toSnapshot(result.rows[0]) : null;
  }

  async listAgents(tenantId: string): Promise<TenantUserSnapshot[]> {
    const result = await this.pool.query<TenantUserRow>(
      `
        select *
        from tenant_users
        where tenant_id = $1
          and status = 'active'
          and role in ('agent', 'broker', 'manager', 'admin')
        order by role asc, name asc
      `,
      [tenantId]
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  private toSnapshot(row: TenantUserRow): TenantUserSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      createdAt: row.created_at.toISOString()
    };
  }
}

