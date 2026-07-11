import type {
  LeadListResponse,
  LeadQueueSummaryResponse,
  LeadSnapshot,
  ListLeadsRequest,
  PropertySearchRequest,
  PropertySearchResponse,
  TenantDashboardMetrics
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";

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

export async function listLeads(request: ListLeadsRequest = { limit: 24 }): Promise<LeadListResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/leads${toQueryString(request)}`, {
      headers: demoHeaders,
      next: { revalidate: 20 }
    });

    if (!response.ok) {
      return demoLeadListResponse();
    }

    return (await response.json()) as LeadListResponse;
  } catch {
    return demoLeadListResponse();
  }
}

export async function getLeadQueueSummary(
  request: ListLeadsRequest = { limit: 24 }
): Promise<LeadQueueSummaryResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/leads/queue-summary${toQueryString(request)}`, {
      headers: demoHeaders,
      next: { revalidate: 20 }
    });

    if (!response.ok) {
      return demoLeadQueueSummaryResponse(request);
    }

    return (await response.json()) as LeadQueueSummaryResponse;
  } catch {
    return demoLeadQueueSummaryResponse(request);
  }
}

export async function listProperties(
  request: PropertySearchRequest = { limit: 30, sort: "created-desc" }
): Promise<PropertySearchResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties${toQueryString(request)}`, {
      headers: demoHeaders,
      next: { revalidate: 20 }
    });

    if (!response.ok) {
      return demoPropertySearchResponse(request);
    }

    return (await response.json()) as PropertySearchResponse;
  } catch {
    return demoPropertySearchResponse(request);
  }
}

function toQueryString(request: object) {
  const params = new URLSearchParams();

  Object.entries(request).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();

  return query ? `?${query}` : "";
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

function demoLeadListResponse(): LeadListResponse {
  const now = new Date();
  const leads: LeadSnapshot[] = [
    {
      id: "lead-demo-001",
      tenantId: demoHeaders["x-tenant-id"],
      propertyId: "property-wongamat-sea-view",
      source: "ai-concierge",
      status: "new",
      contactName: "Irina Volkova",
      contactEmail: "irina@example.com",
      contactPhone: "+66 81 234 1201",
      message: "Relocating to Pattaya with family, quiet area, school access, budget around THB 3.5M.",
      preferredLocale: "ru",
      attributionSearchQuery: "family move to Pattaya quiet area 3.5M",
      attributionSearchSource: "ai",
      priority: "high",
      nextFollowUpAt: addHours(now, 2),
      createdAt: addHours(now, -1),
      updatedAt: addHours(now, -1)
    },
    {
      id: "lead-demo-002",
      tenantId: demoHeaders["x-tenant-id"],
      propertyId: "property-terminal-21-rental-loft",
      source: "saved-search",
      status: "contacted",
      contactName: "Anton Lebedev",
      contactEmail: "anton@example.com",
      message: "Needs 6 month rental near Terminal 21, walkable to beach, remote-work internet.",
      preferredLocale: "ru",
      assignedAgentId: "agent-demo-1",
      attributionSearchQuery: "rent Terminal 21 good internet under 30k",
      attributionSearchSource: "indexed",
      priority: "medium",
      nextFollowUpAt: addHours(now, -3),
      createdAt: addHours(now, -30),
      updatedAt: addHours(now, -8)
    },
    {
      id: "lead-demo-003",
      tenantId: demoHeaders["x-tenant-id"],
      propertyId: "property-pratumnak-investment",
      source: "website",
      status: "qualified",
      contactName: "Maya Chen",
      contactEmail: "maya@example.com",
      contactPhone: "+852 5551 0912",
      message: "Looking for rental yield above 6%, prefers liquid Pattaya condo, cash buyer.",
      preferredLocale: "en",
      assignedAgentId: "agent-demo-2",
      attributionSearchQuery: "Pattaya rental yield above 6%",
      attributionSearchSource: "ai",
      priority: "high",
      nextFollowUpAt: addHours(now, 18),
      createdAt: addHours(now, -52),
      updatedAt: addHours(now, -7)
    },
    {
      id: "lead-demo-004",
      tenantId: demoHeaders["x-tenant-id"],
      propertyId: "property-jomtien-family-corner",
      source: "ai-chat",
      status: "new",
      contactName: "Sergey Orlov",
      contactEmail: "sergey@example.com",
      message: "Compares Jomtien and Wongamat for winter living with two children.",
      preferredLocale: "ru",
      attributionSearchQuery: "winter living family Jomtien Wongamat",
      attributionSearchSource: "ai",
      priority: "medium",
      nextFollowUpAt: addHours(now, 6),
      createdAt: addHours(now, -5),
      updatedAt: addHours(now, -5)
    },
    {
      id: "lead-demo-005",
      tenantId: demoHeaders["x-tenant-id"],
      propertyId: "property-phuket-rawai-pool-villa",
      source: "agent",
      status: "won",
      contactName: "Daniel Moore",
      contactEmail: "daniel@example.com",
      contactPhone: "+44 7700 900321",
      message: "Family villa in Rawai with pool and parking. Contract signed.",
      preferredLocale: "en",
      assignedAgentId: "agent-demo-1",
      priority: "low",
      createdAt: addHours(now, -130),
      updatedAt: addHours(now, -12)
    },
    {
      id: "lead-demo-006",
      tenantId: demoHeaders["x-tenant-id"],
      source: "public-api",
      status: "lost",
      contactName: "Narin S.",
      contactPhone: "+66 82 456 0190",
      message: "Wanted a very short lease under current market range.",
      preferredLocale: "th",
      assignedAgentId: "agent-demo-2",
      priority: "low",
      createdAt: addHours(now, -96),
      updatedAt: addHours(now, -60)
    }
  ];

  return {
    items: leads,
    total: leads.length
  };
}

function demoLeadQueueSummaryResponse(filters: ListLeadsRequest): LeadQueueSummaryResponse {
  const leads = demoLeadListResponse().items;
  const openStatuses = new Set(["new", "contacted", "qualified"]);
  const now = new Date();
  const soon = new Date(now.getTime() + 1000 * 60 * 60 * 24);

  return {
    total: leads.length,
    open: leads.filter((lead) => openStatuses.has(lead.status)).length,
    assigned: leads.filter((lead) => lead.assignedAgentId).length,
    unassigned: leads.filter((lead) => !lead.assignedAgentId).length,
    overdueFollowUps: leads.filter((lead) => lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < now).length,
    dueSoonFollowUps: leads.filter((lead) => {
      if (!lead.nextFollowUpAt) {
        return false;
      }

      const followUpAt = new Date(lead.nextFollowUpAt);

      return followUpAt >= now && followUpAt <= soon;
    }).length,
    highPriority: leads.filter((lead) => lead.priority === "high").length,
    byStatus: countBy(leads, (lead) => lead.status),
    byPriority: countBy(leads, (lead) => lead.priority ?? "none"),
    bySource: countBy(leads, (lead) => lead.source),
    filters,
    generatedAt: new Date().toISOString()
  };
}

function countBy<T>(items: T[], getBucket: (item: T) => string) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const bucket = getBucket(item);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  });

  return [...counts.entries()].map(([bucket, count]) => ({ bucket, count }));
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function demoPropertySearchResponse(filters: PropertySearchRequest): PropertySearchResponse {
  const now = new Date();
  const properties: PropertySnapshot[] = [
    {
      id: "property-wongamat-sea-view",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Wongamat Sea View Residence",
      description: "High-floor condo near Wongamat beach with sea view, fiber internet, pool, gym, and winter rental appeal.",
      kind: "condo",
      listingType: "sale_or_rent",
      market: "pattaya",
      status: "available",
      price: { amount: 3_500_000, currency: "THB" },
      rentalPriceMonthly: { amount: 28_000, currency: "THB" },
      monthlyRentEstimate: { amount: 30_000, currency: "THB" },
      maintenanceFeeMonthly: { amount: 2_400, currency: "THB" },
      location: { latitude: 12.9638, longitude: 100.8842 },
      address: "Wongamat Beach, Pattaya",
      bedrooms: 1,
      bathrooms: 1,
      areaSqm: 45,
      floor: 18,
      beachDistanceMeters: 240,
      amenities: ["sea-view", "pool", "gym", "fiber-internet", "security"],
      createdAt: addHours(now, -12),
      updatedAt: addHours(now, -2)
    },
    {
      id: "property-terminal-21-rental-loft",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Central Pattaya Rental Loft",
      description: "City-center rental loft for tenants who want nightlife, shopping, restaurants, and fast internet near Beach Road.",
      kind: "condo",
      listingType: "rent",
      market: "pattaya",
      status: "available",
      price: { amount: 2_100_000, currency: "THB" },
      rentalPriceMonthly: { amount: 24_000, currency: "THB" },
      monthlyRentEstimate: { amount: 24_000, currency: "THB" },
      location: { latitude: 12.9438, longitude: 100.8918 },
      address: "Central Pattaya, near Beach Road",
      bedrooms: 1,
      bathrooms: 1,
      areaSqm: 38,
      floor: 9,
      beachDistanceMeters: 620,
      amenities: ["fiber-internet", "pool", "coworking", "security"],
      createdAt: addHours(now, -22),
      updatedAt: addHours(now, -4)
    },
    {
      id: "property-pratumnak-investment",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Pratumnak Investment One-Bed",
      description: "Compact ownership case for liquidity-focused investors near cafes, baht bus routes, and beach access.",
      kind: "condo",
      listingType: "sale",
      market: "pattaya",
      status: "reserved",
      price: { amount: 4_600_000, currency: "THB" },
      monthlyRentEstimate: { amount: 34_000, currency: "THB" },
      maintenanceFeeMonthly: { amount: 2_900, currency: "THB" },
      location: { latitude: 12.9178, longitude: 100.8641 },
      address: "Pratumnak Hill, Pattaya",
      bedrooms: 1,
      bathrooms: 1,
      areaSqm: 52,
      floor: 12,
      beachDistanceMeters: 380,
      amenities: ["pool", "gym", "security"],
      createdAt: addHours(now, -44),
      updatedAt: addHours(now, -10)
    },
    {
      id: "property-jomtien-family-corner",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Jomtien Family Corner Condo",
      description: "Larger two-bedroom unit for families who need quieter surroundings, storage, and easier beach weekends.",
      kind: "condo",
      listingType: "sale",
      market: "pattaya",
      status: "draft",
      price: { amount: 4_200_000, currency: "THB" },
      monthlyRentEstimate: { amount: 27_000, currency: "THB" },
      location: { latitude: 12.8876, longitude: 100.8763 },
      address: "Jomtien Second Road, Pattaya",
      bedrooms: 2,
      bathrooms: 2,
      areaSqm: 72,
      floor: 6,
      beachDistanceMeters: 850,
      amenities: ["pool", "parking"],
      createdAt: addHours(now, -50),
      updatedAt: addHours(now, -20)
    },
    {
      id: "property-phuket-rawai-pool-villa",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Phuket Rawai Pool Villa",
      description: "Private villa in Rawai for relocation or family living with pool, parking, outdoor dining, and beach access.",
      kind: "villa",
      listingType: "sale",
      market: "phuket",
      status: "available",
      price: { amount: 12_800_000, currency: "THB" },
      monthlyRentEstimate: { amount: 95_000, currency: "THB" },
      maintenanceFeeMonthly: { amount: 8_500, currency: "THB" },
      location: { latitude: 7.7794, longitude: 98.3253 },
      address: "Rawai, Phuket",
      bedrooms: 3,
      bathrooms: 3,
      areaSqm: 210,
      beachDistanceMeters: 1200,
      amenities: ["private-pool", "parking", "outdoor-dining", "security"],
      createdAt: addHours(now, -72),
      updatedAt: addHours(now, -18)
    },
    {
      id: "property-na-jomtien-beachfront-lease",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Na Jomtien Beachfront Lease",
      description: "Large beachfront rental with calmer resort feel, direct beach access, balcony, and room for longer family stays.",
      kind: "condo",
      listingType: "rent",
      market: "pattaya",
      status: "rented",
      price: { amount: 6_900_000, currency: "THB" },
      rentalPriceMonthly: { amount: 52_000, currency: "THB" },
      monthlyRentEstimate: { amount: 52_000, currency: "THB" },
      location: { latitude: 12.833, longitude: 100.908 },
      address: "Na Jomtien beachfront",
      bedrooms: 2,
      bathrooms: 2,
      areaSqm: 86,
      floor: 14,
      beachDistanceMeters: 70,
      amenities: ["beachfront", "pool", "gym", "security"],
      createdAt: addHours(now, -90),
      updatedAt: addHours(now, -26)
    }
  ];

  return {
    filters,
    items: properties,
    total: properties.length
  };
}
