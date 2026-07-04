import { Inject, Injectable } from "@nestjs/common";
import type { TenantDashboardMetrics } from "@propertyflow/contracts";
import { ANALYTICS_REPOSITORY, type AnalyticsRepository } from "../domain/analytics.repository.js";

@Injectable()
export class AnalyticsService {
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly analytics: AnalyticsRepository) {}

  async getDashboard(tenantId: string): Promise<TenantDashboardMetrics> {
    const metrics = await this.analytics.getTenantMetrics(tenantId);
    const closedLeads = metrics.wonLeads + metrics.lostLeads;

    return {
      tenantId,
      ...metrics,
      conversionRate: closedLeads > 0 ? Math.round((metrics.wonLeads / closedLeads) * 10_000) / 100 : 0,
      generatedAt: new Date().toISOString()
    };
  }
}

