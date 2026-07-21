import type { TenantSnapshot, UpdateTenantSettingsRequest } from "@propertyflow/contracts";

export const TENANT_REPOSITORY = Symbol("TENANT_REPOSITORY");

export interface TenantRepository {
  findById(tenantId: string): Promise<TenantSnapshot | null>;
  findBySlug(slug: string): Promise<TenantSnapshot | null>;
  getUsage(tenantId: string, periodStart: Date, periodEnd: Date): Promise<TenantUsageRawMetrics>;
  recordUsage(tenantId: string, eventType: TenantUsageEventType, metadata?: Record<string, unknown>): Promise<void>;
  updateSettings(tenantId: string, request: UpdateTenantSettingsRequest): Promise<TenantSnapshot | null>;
}

export type TenantUsageEventType = "public-api.request" | "public-widget.ask";

export interface TenantUsageRawMetrics {
  properties: number;
  agents: number;
  aiCreditsMonthly: number;
  publicApiRequestsMonthly: number;
}
