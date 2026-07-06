import { Inject, Injectable } from "@nestjs/common";
import type { TenantDashboardMetrics } from "@propertyflow/contracts";
import { ANALYTICS_REPOSITORY, type AnalyticsRepository } from "../domain/analytics.repository.js";

@Injectable()
export class AnalyticsService {
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly analytics: AnalyticsRepository) {}

  async getDashboard(tenantId: string): Promise<TenantDashboardMetrics> {
    const metrics = await this.analytics.getTenantMetrics(tenantId);
    const {
      conciergePositiveFeedbackCount,
      conciergeTrainingLabeledRows,
      rejectedJobEnqueues,
      blockedAiActions,
      imageDeletePreviews,
      imageRemovals,
      rejectedJobsByName,
      blockedAiActionsByName,
      ...publicMetrics
    } = metrics;
    const closedLeads = metrics.wonLeads + metrics.lostLeads;

    return {
      tenantId,
      ...publicMetrics,
      conversionRate: closedLeads > 0 ? Math.round((metrics.wonLeads / closedLeads) * 10_000) / 100 : 0,
      searchToLeadConversionRate:
        metrics.totalSearches > 0 ? Math.round((metrics.attributedLeads / metrics.totalSearches) * 10_000) / 100 : 0,
      conciergeLeadConversionRate:
        metrics.conciergeSessions > 0 ? Math.round((metrics.conciergeLeads / metrics.conciergeSessions) * 10_000) / 100 : 0,
      conciergePositiveFeedbackRate:
        metrics.conciergeFeedbackCount > 0
          ? Math.round((conciergePositiveFeedbackCount / metrics.conciergeFeedbackCount) * 10_000) / 100
          : 0,
      conciergeTrainingLabelCoverageRate:
        metrics.conciergeTrainingDatasetRows > 0
          ? Math.round((conciergeTrainingLabeledRows / metrics.conciergeTrainingDatasetRows) * 10_000) / 100
          : 0,
      security: {
        rejectedJobEnqueues,
        blockedAiActions,
        imageDeletePreviews,
        imageRemovals,
        rejectedJobsByName,
        blockedAiActionsByName
      },
      generatedAt: new Date().toISOString()
    };
  }
}
