import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AcknowledgeSecurityEventResponse, RequestUser, TenantDashboardMetrics, TenantSecurityEventsResponse } from "@propertyflow/contracts";
import { RealtimePublisherService } from "../../../realtime/application/realtime-publisher.service.js";
import { CurrentUser } from "../../../shared/auth/request-user.decorator.js";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { AnalyticsService } from "../../application/analytics.service.js";
import { AcknowledgeSecurityEventDto } from "./acknowledge-security-event.dto.js";
import { ListSecurityEventsDto } from "./list-security-events.dto.js";

const countByBucketItemSchema = {
  type: "object",
  properties: {
    bucket: { type: "string", example: "saved-search" },
    count: { type: "number", example: 8 }
  },
  required: ["bucket", "count"]
};

@ApiTags("analytics")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: true })
@ApiHeader({ name: "x-user-role", required: true })
@Controller("analytics")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
    @Inject(RealtimePublisherService) private readonly realtime: RealtimePublisherService
  ) {}

  @Get("dashboard")
  @ApiOperation({ summary: "Return tenant dashboard metrics" })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        tenantId: { type: "string", example: "demo-agency" },
        totalProperties: { type: "number", example: 42 },
        availableProperties: { type: "number", example: 31 },
        totalLeads: { type: "number", example: 18 },
        newLeads: { type: "number", example: 5 },
        unassignedLeads: { type: "number", example: 2 },
        leadSlaResponseBreached: { type: "number", example: 4 },
        leadSlaResponseDueSoon: { type: "number", example: 1 },
        leadSlaUnassignedBreached: { type: "number", example: 2 },
        leadSlaOverdueFollowUps: { type: "number", example: 3 },
        leadSlaAverageFirstResponseHours: { type: "number", example: 1.75 },
        leadSlaBreachedBySource: { type: "array", items: countByBucketItemSchema },
        leadSlaBreachRate: { type: "number", example: 22.22 },
        leadSlaHealthScore: { type: "number", example: 77.78 },
        leadQualityIssueCount: { type: "number", example: 9 },
        leadQualityAffectedLeads: { type: "number", example: 6 },
        leadQualityHealthScore: { type: "number", example: 66.67 },
        leadQualityByIssue: { type: "array", items: countByBucketItemSchema },
        leadQualityAffectedBySource: { type: "array", items: countByBucketItemSchema },
        wonLeads: { type: "number", example: 4 },
        lostLeads: { type: "number", example: 3 },
        conversionRate: { type: "number", example: 57.14 },
        totalSearches: { type: "number", example: 120 },
        attributedLeads: { type: "number", example: 16 },
        searchToLeadConversionRate: { type: "number", example: 13.33 },
        averageSearchLatencyMs: { type: "number", example: 82 },
        leadsBySource: { type: "array", items: countByBucketItemSchema },
        leadsByStatus: { type: "array", items: countByBucketItemSchema },
        searchesBySource: { type: "array", items: countByBucketItemSchema },
        topSearchQueries: { type: "array", items: countByBucketItemSchema },
        leadsByAttributedSearchSource: { type: "array", items: countByBucketItemSchema },
        topLeadSearchQueries: { type: "array", items: countByBucketItemSchema },
        conciergeSessions: { type: "number", example: 9 },
        conciergeAwaitingInputSessions: { type: "number", example: 2 },
        conciergeRecommendedSessions: { type: "number", example: 7 },
        conciergeLeads: { type: "number", example: 3 },
        conciergeLeadConversionRate: { type: "number", example: 33.33 },
        savedSearches: { type: "number", example: 12 },
        savedSearchLeads: { type: "number", example: 8 },
        savedSearchConvertedSearches: { type: "number", example: 5 },
        savedSearchLeadConversionRate: { type: "number", example: 41.67 },
        savedSearchOpenOpportunities: { type: "number", example: 3 },
        savedSearchFollowUpCompletionRate: { type: "number", example: 75 },
        savedSearchMatchedProperties: { type: "number", example: 64 },
        savedSearchLeadCoveredMatches: { type: "number", example: 14 },
        savedSearchLeadCoverageRate: { type: "number", example: 21.88 },
        conciergeFeedbackCount: { type: "number", example: 6 },
        conciergePositiveFeedbackRate: { type: "number", example: 83.33 },
        conciergeTrainingDatasetRows: { type: "number", example: 7 },
        conciergeTrainingLabelCoverageRate: { type: "number", example: 71.43 },
        conciergeRecommendationsByArea: {
          type: "array",
          items: countByBucketItemSchema
        },
        conciergeFeedbackByRating: {
          type: "array",
          items: countByBucketItemSchema
        },
        security: {
          type: "object",
          properties: {
            rejectedJobEnqueues: { type: "number", example: 2 },
            blockedAiActions: { type: "number", example: 1 },
            imageDeletePreviews: { type: "number", example: 4 },
            imageRemovals: { type: "number", example: 2 },
            rejectedJobsByName: {
              type: "array",
              items: countByBucketItemSchema
            },
            blockedAiActionsByName: {
              type: "array",
              items: countByBucketItemSchema
            }
          },
          required: [
            "rejectedJobEnqueues",
            "blockedAiActions",
            "imageDeletePreviews",
            "imageRemovals",
            "rejectedJobsByName",
            "blockedAiActionsByName"
          ]
        },
        generatedAt: { type: "string", format: "date-time" }
      },
      required: [
        "tenantId",
        "totalProperties",
        "availableProperties",
        "totalLeads",
        "newLeads",
        "unassignedLeads",
        "leadSlaResponseBreached",
        "leadSlaResponseDueSoon",
        "leadSlaUnassignedBreached",
        "leadSlaOverdueFollowUps",
        "leadSlaBreachedBySource",
        "leadSlaBreachRate",
        "leadSlaHealthScore",
        "leadQualityIssueCount",
        "leadQualityAffectedLeads",
        "leadQualityHealthScore",
        "leadQualityByIssue",
        "leadQualityAffectedBySource",
        "wonLeads",
        "lostLeads",
        "conversionRate",
        "totalSearches",
        "attributedLeads",
        "searchToLeadConversionRate",
        "averageSearchLatencyMs",
        "leadsBySource",
        "leadsByStatus",
        "searchesBySource",
        "topSearchQueries",
        "leadsByAttributedSearchSource",
        "topLeadSearchQueries",
        "conciergeSessions",
        "conciergeAwaitingInputSessions",
        "conciergeRecommendedSessions",
        "conciergeLeads",
        "conciergeLeadConversionRate",
        "savedSearches",
        "savedSearchLeads",
        "savedSearchConvertedSearches",
        "savedSearchLeadConversionRate",
        "savedSearchOpenOpportunities",
        "savedSearchFollowUpCompletionRate",
        "savedSearchMatchedProperties",
        "savedSearchLeadCoveredMatches",
        "savedSearchLeadCoverageRate",
        "conciergeFeedbackCount",
        "conciergePositiveFeedbackRate",
        "conciergeTrainingDatasetRows",
        "conciergeTrainingLabelCoverageRate",
        "conciergeRecommendationsByArea",
        "conciergeFeedbackByRating",
        "security",
        "generatedAt"
      ]
    }
  })
  @Roles("broker", "manager", "admin")
  dashboard(@TenantId() tenantId: string): Promise<TenantDashboardMetrics> {
    return this.analytics.getDashboard(tenantId);
  }

  @Get("security-events")
  @Roles("manager", "admin")
  securityEvents(
    @TenantId() tenantId: string,
    @Query() query: ListSecurityEventsDto
  ): Promise<TenantSecurityEventsResponse> {
    return this.analytics.listSecurityEvents(tenantId, query);
  }

  @Post("security-events/:eventId/acknowledge")
  @Roles("manager", "admin")
  async acknowledgeSecurityEvent(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("eventId") eventId: string,
    @Body() payload: AcknowledgeSecurityEventDto
  ): Promise<AcknowledgeSecurityEventResponse> {
    const result = await this.analytics.acknowledgeSecurityEvent(tenantId, eventId, payload, user);

    this.realtime.publish(tenantId, "security.event_acknowledged", {
      eventId: result.event.id,
      kind: result.event.kind,
      severity: result.event.severity,
      acknowledgedAt: result.event.acknowledgedAt,
      acknowledgedByUserId: result.event.acknowledgedByUserId,
      acknowledgedByUserRole: result.event.acknowledgedByUserRole,
      note: result.event.acknowledgementNote
    });

    return result;
  }
}
