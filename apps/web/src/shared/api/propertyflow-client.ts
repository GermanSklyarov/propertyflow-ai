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
  PropertyImageGalleryResponse,
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

export async function getPropertyImages(propertyId: string): Promise<PropertyImageGalleryResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/images`, {
      headers: demoHeaders,
      next: { revalidate: 30 }
    });

    if (!response.ok) {
      return demoPropertyImageGallery(propertyId);
    }

    return (await response.json()) as PropertyImageGalleryResponse;
  } catch {
    return demoPropertyImageGallery(propertyId);
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

export async function createWebsiteLead(
  request: Omit<CreateLeadRequest, "source"> & { source?: CreateLeadRequest["source"] }
): Promise<LeadSnapshot> {
  const payload: CreateLeadRequest = {
    ...request,
    source: request.source ?? "website"
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

function demoPropertyImageGallery(propertyId: string): PropertyImageGalleryResponse {
  const property = fallbackProperty(propertyId);
  const now = new Date().toISOString();

  if (!property) {
    return { images: [], propertyId };
  }

  return {
    images: demoPropertyImageUrls(property).map((imageUrl, index) => ({
      caption: index === 0 ? `${property.title} cover` : `${property.title} photo ${index + 1}`,
      createdAt: now,
      id: `${propertyId}-public-image-${index + 1}`,
      imageUrl,
      position: index,
      propertyId,
      tenantId: demoHeaders["x-tenant-id"]
    })),
    propertyId
  };
}

function demoPropertyImageUrls(property: PropertySnapshot) {
  if (property.kind === "villa") {
    return [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85"
    ];
  }

  if (property.address?.toLowerCase().includes("terminal")) {
    return [
      "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1400&q=85",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=85"
    ];
  }

  if (property.bedrooms >= 2) {
    return [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=85",
      "https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=85"
    ];
  }

  return [
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1560448075-bb485b067938?auto=format&fit=crop&w=900&q=85"
  ];
}
