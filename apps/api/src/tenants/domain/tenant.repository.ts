import type { TenantSnapshot, UpdateTenantSettingsRequest } from "@propertyflow/contracts";

export const TENANT_REPOSITORY = Symbol("TENANT_REPOSITORY");

export interface TenantRepository {
  findById(tenantId: string): Promise<TenantSnapshot | null>;
  findBySlug(slug: string): Promise<TenantSnapshot | null>;
  getUsage(tenantId: string, periodStart: Date, periodEnd: Date): Promise<TenantUsageRawMetrics>;
  updateSettings(tenantId: string, request: UpdateTenantSettingsRequest): Promise<TenantSnapshot | null>;
}

export interface TenantUsageRawMetrics {
  properties: number;
  agents: number;
  aiCreditsMonthly: number;
  publicApiRequestsMonthly: number;
}
