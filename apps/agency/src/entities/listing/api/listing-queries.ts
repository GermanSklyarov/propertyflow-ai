import type { PropertySearchRequest } from "@propertyflow/contracts";
import { queryOptions } from "@tanstack/react-query";
import { listProperties } from "@shared/api/agency-client";
import { queryKeys } from "@shared/query/query-keys";

const defaultListingRequest = { limit: 30, sort: "created-desc" } satisfies PropertySearchRequest;

export function listingsQueryOptions(request: PropertySearchRequest = defaultListingRequest) {
  return queryOptions({
    queryKey: queryKeys.listings.list(request),
    queryFn: () => listProperties(request)
  });
}
