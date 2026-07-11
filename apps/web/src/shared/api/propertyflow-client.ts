import type {
  ConciergeRequest,
  ConciergeResponse,
  ComparePropertiesRequest,
  CreateLeadRequest,
  LeadSnapshot,
  PropertyComparisonResponse,
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
