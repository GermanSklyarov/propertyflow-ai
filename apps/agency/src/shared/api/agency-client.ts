import type { TenantDashboardMetrics } from "@propertyflow/contracts";

const apiBaseUrl =
  process.env.PROPERTYFLOW_API_URL ?? process.env.NEXT_PUBLIC_PROPERTYFLOW_API_URL ?? "http://127.0.0.1:3001";

const demoHeaders = {
  "x-tenant-id": process.env.PROPERTYFLOW_TENANT_ID ?? "demo-agency",
  "x-user-id": process.env.PROPERTYFLOW_USER_ID ?? "manager-demo-1",
  "x-user-role": process.env.PROPERTYFLOW_USER_ROLE ?? "manager"
};

export async function getTenantDashboardMetrics(): Promise<TenantDashboardMetrics> {
  try {
    const response = await fetch(`${apiBaseUrl}/analytics/dashboard`, {
      headers: demoHeaders,
      next: { revalidate: 30 }
    });

    if (!response.ok) {
      return demoTenantDashboardMetrics();
    }

    return (await response.json()) as TenantDashboardMetrics;
  } catch {
    return demoTenantDashboardMetrics();
  }
}

function demoTenantDashboardMetrics(): TenantDashboardMetrics {
  const totalLeads = 38;
  const wonLeads = 11;
  const lostLeads = 7;
  const conciergeLeads = 12;
  const savedSearchLeads = 9;

  return {
    attributedLeads: 24,
    availableProperties: 12,
    averageSearchLatencyMs: 118,
    conciergeAwaitingInputSessions: 8,
    conciergeFeedbackByRating: [
      { bucket: "positive", count: 18 },
      { bucket: "neutral", count: 5 },
      { bucket: "negative", count: 2 }
    ],
    conciergeFeedbackCount: 25,
    conciergeLeadConversionRate: conciergeLeads / 31,
    conciergeLeads,
    conciergePositiveFeedbackRate: 0.72,
    conciergeRecommendedSessions: 23,
    conciergeRecommendationsByArea: [
      { bucket: "Wongamat", count: 11 },
      { bucket: "Jomtien", count: 7 },
      { bucket: "Pratumnak", count: 5 }
    ],
    conciergeSessions: 31,
    conciergeTrainingDatasetRows: 128,
    conciergeTrainingLabelCoverageRate: 0.64,
    conversionRate: wonLeads / Math.max(1, wonLeads + lostLeads),
    generatedAt: new Date().toISOString(),
    leadQualityAffectedByAgent: [
      { bucket: "agent-demo-1", count: 4 },
      { bucket: "agent-demo-2", count: 2 }
    ],
    leadQualityAffectedBySource: [
      { bucket: "website", count: 5 },
      { bucket: "ai-concierge", count: 3 }
    ],
    leadQualityAffectedLeads: 7,
    leadQualityByIssue: [
      { bucket: "missing-follow-up", count: 4 },
      { bucket: "unassigned", count: 3 }
    ],
    leadQualityHealthScore: 84,
    leadQualityIssueCount: 9,
    leadSlaAverageFirstResponseHours: 2.6,
    leadSlaBreachRate: 0.08,
    leadSlaBreachedBySource: [
      { bucket: "website", count: 2 },
      { bucket: "saved-search", count: 1 }
    ],
    leadSlaHealthScore: 91,
    leadSlaOverdueFollowUps: 3,
    leadSlaResponseBreached: 2,
    leadSlaResponseDueSoon: 5,
    leadSlaUnassignedBreached: 1,
    leadsByAttributedSearchSource: [
      { bucket: "ai-search", count: 13 },
      { bucket: "saved-search", count: 9 }
    ],
    leadsBySource: [
      { bucket: "website", count: 14 },
      { bucket: "ai-concierge", count: conciergeLeads },
      { bucket: "saved-search", count: savedSearchLeads }
    ],
    leadsByStatus: [
      { bucket: "new", count: 8 },
      { bucket: "qualified", count: 12 },
      { bucket: "won", count: wonLeads },
      { bucket: "lost", count: lostLeads }
    ],
    lostLeads,
    newLeads: 8,
    savedSearchConvertedSearches: 6,
    savedSearchFollowUpCompletionRate: 0.58,
    savedSearchLeadConversionRate: savedSearchLeads / 19,
    savedSearchLeadCoverageRate: 0.42,
    savedSearchLeadCoveredMatches: 14,
    savedSearchLeads,
    savedSearchMatchedProperties: 33,
    savedSearchOpenOpportunities: 7,
    savedSearches: 19,
    searchesBySource: [
      { bucket: "ai-search", count: 86 },
      { bucket: "catalog", count: 44 },
      { bucket: "concierge", count: 31 }
    ],
    searchToLeadConversionRate: 0.18,
    security: {
      blockedAiActions: 2,
      blockedAiActionsByName: [{ bucket: "property.image.delete", count: 2 }],
      imageDeletePreviews: 5,
      imageRemovals: 1,
      rejectedJobEnqueues: 1,
      rejectedJobsByName: [{ bucket: "concierge.model.train", count: 1 }]
    },
    tenantId: demoHeaders["x-tenant-id"],
    topLeadSearchQueries: [
      { bucket: "quiet condo near Terminal 21", count: 6 },
      { bucket: "rent in Pattaya under 30k", count: 4 }
    ],
    topSearchQueries: [
      { bucket: "Terminal 21 walkable", count: 18 },
      { bucket: "Wongamat family condo", count: 12 },
      { bucket: "Pattaya yield above 6%", count: 9 }
    ],
    totalLeads,
    totalProperties: 18,
    totalSearches: 161,
    unassignedLeads: 5,
    wonLeads
  };
}
