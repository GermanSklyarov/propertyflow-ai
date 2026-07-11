import type {
  ConciergeRequest,
  ConciergeResponse,
  ComparePropertiesRequest,
  CreateSavedPropertySearchRequest,
  CreateLeadRequest,
  LeadSnapshot,
  NaturalLanguagePropertySearchResponse,
  NaturalLanguageSearchRequest,
  PropertyComparisonResponse,
  TenantDashboardMetrics,
  SavedPropertySearchSnapshot,
  PropertySearchSort,
  PropertySearchResponse
} from "@propertyflow/contracts";
import type { PropertyListingType, PropertySnapshot } from "@propertyflow/domain";
import { buildDemoConciergeResponse } from "../../entities/concierge/model/demo-concierge-response";
import { demoProperties } from "../../entities/property/model/demo-properties";
import { buildFallbackPropertyComparison } from "../../features/property-compare/model/property-comparison-fallback";

const apiBaseUrl =
  process.env.PROPERTYFLOW_API_URL ?? process.env.NEXT_PUBLIC_PROPERTYFLOW_API_URL ?? "http://127.0.0.1:3001";

const demoHeaders = {
  "x-tenant-id": process.env.PROPERTYFLOW_TENANT_ID ?? "demo-agency",
  "x-user-id": process.env.PROPERTYFLOW_USER_ID ?? "manager-demo-1",
  "x-user-role": process.env.PROPERTYFLOW_USER_ROLE ?? "manager"
};

const featuredPropertiesLimit = 12;

export type FeaturedPropertiesRequest = {
  limit?: number;
  listingType?: PropertyListingType;
  sort?: PropertySearchSort;
};

export async function listFeaturedProperties(request: FeaturedPropertiesRequest = {}): Promise<PropertySnapshot[]> {
  const limit = request.limit ?? featuredPropertiesLimit;
  const searchParams = new URLSearchParams({
    limit: String(limit),
    sort: request.sort ?? "ai-fit"
  });

  if (request.listingType) {
    searchParams.set("listingType", request.listingType);
  }

  try {
    const response = await fetch(`${apiBaseUrl}/properties?${searchParams.toString()}`, {
      headers: demoHeaders,
      next: { revalidate: 30 }
    });

    if (!response.ok) {
      return demoProperties;
    }

    const body = (await response.json()) as PropertySearchResponse;
    return body.items.length > 0 ? body.items.slice(0, limit).map(normalizeProperty) : demoProperties;
  } catch {
    return demoProperties;
  }
}

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

export async function getPropertyById(propertyId: string): Promise<PropertySnapshot | undefined> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/${propertyId}`, {
      headers: demoHeaders,
      next: { revalidate: 30 }
    });

    if (!response.ok) {
      return fallbackProperty(propertyId);
    }

    return normalizeProperty((await response.json()) as PropertySnapshot);
  } catch {
    return fallbackProperty(propertyId);
  }
}

export async function askConcierge(request: ConciergeRequest): Promise<ConciergeResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/concierge/advise`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...demoHeaders
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      return buildDemoConciergeResponse(request);
    }

    return (await response.json()) as ConciergeResponse;
  } catch {
    return buildDemoConciergeResponse(request);
  }
}

export async function compareProperties(request: ComparePropertiesRequest): Promise<PropertyComparisonResponse> {
  const selectedProperties = request.propertyIds
    .map((propertyId) => demoProperties.find((property) => property.id === propertyId))
    .filter((property): property is PropertySnapshot => Boolean(property));

  try {
    const response = await fetch(`${apiBaseUrl}/properties/compare`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...demoHeaders
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      return buildFallbackPropertyComparison(selectedProperties);
    }

    return (await response.json()) as PropertyComparisonResponse;
  } catch {
    return buildFallbackPropertyComparison(selectedProperties);
  }
}

export async function searchPropertiesByNaturalLanguage(
  request: NaturalLanguageSearchRequest
): Promise<NaturalLanguagePropertySearchResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/ai-search`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...demoHeaders
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      return demoNaturalLanguageSearch(request);
    }

    const body = (await response.json()) as NaturalLanguagePropertySearchResponse;

    return {
      ...body,
      items: body.items.map(normalizeProperty)
    };
  } catch {
    return demoNaturalLanguageSearch(request);
  }
}

export async function createSavedPropertySearch(
  request: CreateSavedPropertySearchRequest
): Promise<SavedPropertySearchSnapshot> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/saved-searches`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...demoHeaders
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      return demoSavedSearch(request);
    }

    return (await response.json()) as SavedPropertySearchSnapshot;
  } catch {
    return demoSavedSearch(request);
  }
}

export async function createWebsiteLead(request: Omit<CreateLeadRequest, "source">): Promise<LeadSnapshot> {
  const payload: CreateLeadRequest = {
    ...request,
    source: "website"
  };

  try {
    const response = await fetch(`${apiBaseUrl}/leads`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...demoHeaders
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return demoLead(payload);
    }

    return (await response.json()) as LeadSnapshot;
  } catch {
    return demoLead(payload);
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
    availableProperties: demoProperties.filter((property) => property.status === "available").length,
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
    totalProperties: demoProperties.length,
    totalSearches: 161,
    unassignedLeads: 5,
    wonLeads
  };
}

function demoSavedSearch(request: CreateSavedPropertySearchRequest): SavedPropertySearchSnapshot {
  const now = new Date().toISOString();

  return {
    createdAt: now,
    filters: request.filters ?? {},
    id: `demo-saved-search-${Date.now()}`,
    locale: request.locale,
    matchCount: demoProperties.length,
    naturalLanguageQuery: request.naturalLanguageQuery,
    notificationsEnabled: request.notificationsEnabled ?? true,
    purpose: request.purpose,
    tenantId: demoHeaders["x-tenant-id"],
    title: request.title,
    updatedAt: now,
    userId: demoHeaders["x-user-id"]
  };
}

function demoNaturalLanguageSearch(request: NaturalLanguageSearchRequest): NaturalLanguagePropertySearchResponse {
  const query = request.query.toLowerCase();
  const market = request.market ?? detectSearchMarket(query);
  const listingType = detectSearchListingType(query);
  const maxPriceThb = detectMaxPriceThb(query);
  const maxMonthlyRentThb = detectMaxMonthlyRentThb(query);
  const maxBeachDistanceMeters = /beach|море|пляж|terminal 21|walk|пешком/.test(query) ? 1_000 : undefined;
  const requiredAmenities = /internet|remote|cowork|интернет|удален/.test(query) ? ["fast-internet"] : undefined;
  const lifestyleSignals = [
    /quiet|тих/.test(query) ? "quiet-area" : undefined,
    /family|children|семь|дет/.test(query) ? "family-fit" : undefined,
    /beach|море|пляж/.test(query) ? "beach-access" : undefined
  ].filter((signal): signal is string => Boolean(signal));
  const items = demoProperties
    .filter((property) => !market || property.market === market)
    .filter((property) => !listingType || property.listingType === listingType || property.listingType === "sale_or_rent")
    .filter((property) => !maxPriceThb || property.price.amount <= maxPriceThb)
    .filter((property) => !maxMonthlyRentThb || (property.rentalPriceMonthly?.amount ?? Number.POSITIVE_INFINITY) <= maxMonthlyRentThb)
    .filter((property) => !maxBeachDistanceMeters || (property.beachDistanceMeters ?? Number.POSITIVE_INFINITY) <= maxBeachDistanceMeters)
    .filter((property) =>
      !requiredAmenities?.length || requiredAmenities.some((amenity) => property.amenities.includes(amenity))
    );

  return {
    filters: {
      investmentSignals: request.purpose === "investment" ? ["rental-yield"] : [],
      lifestyleSignals,
      listingType,
      market,
      maxBeachDistanceMeters,
      maxMonthlyRentThb,
      maxPriceThb,
      requiredAmenities
    },
    interpretedIntent: describeSearchIntent(request.query, items.length),
    items: items.length ? items : demoProperties,
    rankingExplanation:
      "Demo AI Search ranked listings by detected market, listing intent, budget, beach access, and lifestyle signals.",
    total: items.length || demoProperties.length
  };
}

function detectSearchMarket(query: string) {
  if (/phuket|пхукет/.test(query)) {
    return "phuket";
  }

  if (/bangkok|бангкок|ekkamai/.test(query)) {
    return "bangkok";
  }

  return /pattaya|паттай|terminal 21|wongamat|jomtien/.test(query) ? "pattaya" : undefined;
}

function detectSearchListingType(query: string) {
  if (/rent|lease|аренд|снять/.test(query)) {
    return "rent";
  }

  if (/buy|sale|purchase|купить|покуп/.test(query)) {
    return "sale";
  }

  return undefined;
}

function detectMaxPriceThb(query: string) {
  const millionMatch = query.match(/(?:under|до|budget|бюджет)?\s*(\d+(?:[.,]\d+)?)\s*(?:m|mln|million|млн)/);

  return millionMatch?.[1] ? Math.round(Number.parseFloat(millionMatch[1].replace(",", ".")) * 1_000_000) : undefined;
}

function detectMaxMonthlyRentThb(query: string) {
  const rentMatch = query.match(/(\d+(?:[.,]\d+)?)\s*(?:k|тыс|thousand)?\s*(?:thb|бат|\/month|per month|monthly|мес)/);

  if (!rentMatch?.[1]) {
    return undefined;
  }

  const amount = Number.parseFloat(rentMatch[1].replace(",", "."));

  return amount < 1_000 ? Math.round(amount * 1_000) : Math.round(amount);
}

function describeSearchIntent(query: string, matchCount: number) {
  return `AI interpreted "${query}" into ${matchCount} ranked ${matchCount === 1 ? "listing" : "listings"}.`;
}

function normalizeProperty(property: PropertySnapshot): PropertySnapshot {
  return {
    ...property,
    listingType: property.listingType ?? "sale"
  };
}

function demoLead(payload: CreateLeadRequest): LeadSnapshot {
  const now = new Date().toISOString();

  return {
    id: `demo-lead-${Date.now()}`,
    tenantId: demoHeaders["x-tenant-id"],
    propertyId: payload.propertyId,
    source: payload.source,
    status: "new",
    contactName: payload.contactName,
    contactEmail: payload.contactEmail,
    contactPhone: payload.contactPhone,
    message: payload.message,
    preferredLocale: payload.preferredLocale,
    priority: "medium",
    createdAt: now,
    updatedAt: now
  };
}

function fallbackProperty(propertyId: string): PropertySnapshot | undefined {
  const exactMatch = demoProperties.find((property) => property.id === propertyId);

  if (exactMatch) {
    return exactMatch;
  }

  const template = demoProperties[0];

  if (!template) {
    return undefined;
  }

  return {
    ...template,
    id: propertyId,
    title: "Property brief preview",
    description:
      "The live API is not available for this listing right now, so PropertyFlow is showing a safe demo brief with the same decision layout."
  };
}
