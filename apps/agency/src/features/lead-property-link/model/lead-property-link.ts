import type { PropertySearchRequest, PropertySearchSort } from "@propertyflow/contracts";

export const leadPropertyCandidatePageSize = 6;

export const leadPropertyCandidateSortOptions = [
  "created-desc",
  "price-asc",
  "price-desc",
  "rent-asc",
  "yield-desc"
] as const satisfies PropertySearchSort[];

type LeadPropertyCandidateSort = (typeof leadPropertyCandidateSortOptions)[number];

export interface LeadPropertyLinkSearchParams {
  listingPage?: string;
  listingSearch?: string;
  listingSort?: string;
}

export function parseLeadPropertyCandidateRequest(query: LeadPropertyLinkSearchParams): PropertySearchRequest {
  const search = query.listingSearch?.trim();
  const page = parsePositivePage(query.listingPage);
  const sort = parseCandidateSort(query.listingSort) ?? "created-desc";

  return {
    limit: leadPropertyCandidatePageSize,
    offset: (page - 1) * leadPropertyCandidatePageSize,
    query: search || undefined,
    sort
  };
}

export function getLeadPropertyCandidatePage(request: PropertySearchRequest) {
  return Math.floor((request.offset ?? 0) / (request.limit ?? leadPropertyCandidatePageSize)) + 1;
}

export function formatLeadPropertyCandidateSort(sort: PropertySearchSort) {
  const labels = {
    "ai-fit": "AI fit",
    "beach-asc": "Beach distance",
    "created-desc": "Newest first",
    "price-asc": "Price low to high",
    "price-desc": "Price high to low",
    "rent-asc": "Rent low to high",
    "yield-desc": "Yield strongest"
  } satisfies Record<PropertySearchSort, string>;

  return labels[sort];
}

export function buildLeadPropertyCandidateHref(
  leadId: string,
  request: PropertySearchRequest,
  patch: Partial<PropertySearchRequest> & { page?: number }
) {
  const nextRequest = {
    query: request.query,
    sort: request.sort,
    ...patch
  };
  const params = new URLSearchParams();

  if (nextRequest.query) {
    params.set("listingSearch", nextRequest.query);
  }

  if (nextRequest.sort && nextRequest.sort !== "created-desc") {
    params.set("listingSort", nextRequest.sort);
  }

  if (nextRequest.page && nextRequest.page > 1) {
    params.set("listingPage", String(nextRequest.page));
  }

  const suffix = params.toString();

  return suffix ? `/leads/${leadId}?${suffix}#link-listing` : `/leads/${leadId}#link-listing`;
}

function parsePositivePage(value?: string) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseCandidateSort(value?: string): LeadPropertyCandidateSort | undefined {
  if (leadPropertyCandidateSortOptions.includes(value as LeadPropertyCandidateSort)) {
    return value as LeadPropertyCandidateSort;
  }

  return undefined;
}
