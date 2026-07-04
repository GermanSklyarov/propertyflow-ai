import type { CountByBucket } from "@propertyflow/contracts";

export const ANALYTICS_REPOSITORY = Symbol("ANALYTICS_REPOSITORY");

export interface TenantAnalyticsRawMetrics {
  totalProperties: number;
  availableProperties: number;
  totalLeads: number;
  newLeads: number;
  unassignedLeads: number;
  wonLeads: number;
  lostLeads: number;
  totalSearches: number;
  averageSearchLatencyMs: number;
  leadsBySource: CountByBucket[];
  leadsByStatus: CountByBucket[];
  searchesBySource: CountByBucket[];
  topSearchQueries: CountByBucket[];
}

export interface AnalyticsRepository {
  getTenantMetrics(tenantId: string): Promise<TenantAnalyticsRawMetrics>;
}
