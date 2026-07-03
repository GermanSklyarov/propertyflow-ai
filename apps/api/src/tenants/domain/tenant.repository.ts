import type { TenantSnapshot } from "@propertyflow/contracts";

export const TENANT_REPOSITORY = Symbol("TENANT_REPOSITORY");

export interface TenantRepository {
  findById(tenantId: string): Promise<TenantSnapshot | null>;
}

