import type { TenantSnapshot, UpdateTenantSettingsRequest } from "@propertyflow/contracts";

export const TENANT_REPOSITORY = Symbol("TENANT_REPOSITORY");

export interface TenantRepository {
  findById(tenantId: string): Promise<TenantSnapshot | null>;
  updateSettings(tenantId: string, request: UpdateTenantSettingsRequest): Promise<TenantSnapshot | null>;
}
