import type {
  RecordUsageEventRequest,
  TenantSnapshot,
  TenantSubscriptionPlan,
  UpdateTenantSettingsRequest
} from "@propertyflow/contracts";

export const TENANT_REPOSITORY = Symbol("TENANT_REPOSITORY");

export interface TenantRepository {
  findById(tenantId: string): Promise<TenantSnapshot | null>;
  findBySlug(slug: string): Promise<TenantSnapshot | null>;
  getUsage(tenantId: string, periodStart: Date, periodEnd: Date): Promise<TenantUsageRawMetrics>;
  provision(input: ProvisionTenantRepositoryInput): Promise<TenantSnapshot>;
  recordGenericUsage(input: RecordUsageEventRequest): Promise<void>;
  recordUsage(tenantId: string, eventType: TenantUsageEventType, metadata?: Record<string, unknown>): Promise<void>;
  updateSettings(tenantId: string, request: UpdateTenantSettingsRequest): Promise<TenantSnapshot | null>;
}

export type TenantUsageEventType = "public-api.request" | "public-widget.ask";

export interface ProvisionTenantRepositoryInput {
  name: string;
  ownerEmail: string;
  ownerName: string;
  ownerUserId: string;
  slug: string;
  subscriptionPlan: TenantSubscriptionPlan;
  website?: string;
}

export interface TenantUsageRawMetrics {
  properties: number;
  agents: number;
  aiCreditsMonthly: number;
  publicApiRequestsMonthly: number;
}
