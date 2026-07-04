import type { TenantUserSnapshot } from "@propertyflow/contracts";

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

export interface UserRepository {
  findById(tenantId: string, userId: string): Promise<TenantUserSnapshot | null>;
  listAgents(tenantId: string): Promise<TenantUserSnapshot[]>;
}

