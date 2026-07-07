import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AcknowledgeSecurityEventRequest,
  AcknowledgeSecurityEventResponse,
  RequestUser,
  TenantDashboardMetrics,
  TenantSecurityEventsRequest,
  TenantSecurityEventsResponse
} from "@propertyflow/contracts";
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
      savedSearchLeadConversionRate:
        metrics.savedSearches > 0 ? Math.round((metrics.savedSearchLeads / metrics.savedSearches) * 10_000) / 100 : 0,
      savedSearchFollowUpCompletionRate:
        metrics.savedSearches > 0
          ? Math.round(((metrics.savedSearches - metrics.savedSearchOpenOpportunities) / metrics.savedSearches) * 10_000) / 100
          : 0,
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

  async listSecurityEvents(
    tenantId: string,
    request: TenantSecurityEventsRequest = {}
  ): Promise<TenantSecurityEventsResponse> {
    const boundedLimit = Math.min(Math.max(request.limit ?? 50, 1), 100);
    const filters = {
      ...request,
      limit: boundedLimit
    };
    const result = await this.analytics.listSecurityEvents(tenantId, filters);

    return {
      items: result.items,
      total: result.summary.total,
      limit: boundedLimit,
      filters,
      summary: result.summary
    };
  }

  async acknowledgeSecurityEvent(
    tenantId: string,
    eventId: string,
    request: AcknowledgeSecurityEventRequest,
    user: RequestUser
  ): Promise<AcknowledgeSecurityEventResponse> {
    const event = await this.analytics.acknowledgeSecurityEvent(tenantId, eventId, request, user);

    if (!event) {
      throw new NotFoundException("Security event not found");
    }

    return { event };
  }
}
