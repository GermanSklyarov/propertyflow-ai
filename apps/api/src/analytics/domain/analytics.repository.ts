import type {
  AcknowledgeSecurityEventRequest,
  CountByBucket,
  RequestUser,
  TenantSecurityEventsRequest,
  TenantSecurityEventsSummary,
  TenantSecurityEventSnapshot
} from "@propertyflow/contracts";

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
  attributedLeads: number;
  averageSearchLatencyMs: number;
  leadsBySource: CountByBucket[];
  leadsByStatus: CountByBucket[];
  searchesBySource: CountByBucket[];
  topSearchQueries: CountByBucket[];
  leadsByAttributedSearchSource: CountByBucket[];
  topLeadSearchQueries: CountByBucket[];
  conciergeSessions: number;
  conciergeAwaitingInputSessions: number;
  conciergeRecommendedSessions: number;
  conciergeLeads: number;
  savedSearches: number;
  savedSearchLeads: number;
  savedSearchConvertedSearches: number;
  savedSearchOpenOpportunities: number;
  savedSearchMatchedProperties: number;
  savedSearchLeadCoveredMatches: number;
  conciergeFeedbackCount: number;
  conciergePositiveFeedbackCount: number;
  conciergeTrainingDatasetRows: number;
  conciergeTrainingLabeledRows: number;
  conciergeRecommendationsByArea: CountByBucket[];
  conciergeFeedbackByRating: CountByBucket[];
  rejectedJobEnqueues: number;
  blockedAiActions: number;
  imageDeletePreviews: number;
  imageRemovals: number;
  rejectedJobsByName: CountByBucket[];
  blockedAiActionsByName: CountByBucket[];
}

export interface AnalyticsRepository {
  getTenantMetrics(tenantId: string): Promise<TenantAnalyticsRawMetrics>;
  listSecurityEvents(tenantId: string, request: TenantSecurityEventsRequest): Promise<TenantSecurityEventsQueryResult>;
  acknowledgeSecurityEvent(
    tenantId: string,
    eventId: string,
    request: AcknowledgeSecurityEventRequest,
    user: RequestUser
  ): Promise<TenantSecurityEventSnapshot | null>;
}

export interface TenantSecurityEventsQueryResult {
  items: TenantSecurityEventSnapshot[];
  summary: TenantSecurityEventsSummary;
}
