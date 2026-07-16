import type { GeneratePropertySocialPostsRequest, PropertySearchRequest } from "@propertyflow/contracts";
import { queryOptions } from "@tanstack/react-query";
import {
  generatePropertySocialPostDrafts,
  getProperty,
  getPropertyAiAssets,
  getPropertyImages,
  listProperties
} from "@shared/api/agency-client";
import { queryKeys } from "@shared/query/query-keys";

const defaultListingRequest = { limit: 30, sort: "created-desc" } satisfies PropertySearchRequest;

export function listingsQueryOptions(request: PropertySearchRequest = defaultListingRequest) {
  return queryOptions({
    queryKey: queryKeys.listings.list(request),
    queryFn: () => listProperties(request)
  });
}

export function listingDetailQueryOptions(propertyId: string) {
  return queryOptions({
    queryKey: queryKeys.listings.detail(propertyId),
    queryFn: () => getProperty(propertyId)
  });
}

export function listingImagesQueryOptions(propertyId: string) {
  return queryOptions({
    queryKey: queryKeys.listings.images(propertyId),
    queryFn: () => getPropertyImages(propertyId)
  });
}

export function listingAiAssetsQueryOptions(propertyId: string) {
  return queryOptions({
    queryKey: queryKeys.listings.aiAssets(propertyId),
    queryFn: () => getPropertyAiAssets(propertyId)
  });
}

export function listingSocialPostsQueryOptions(propertyId: string, request: GeneratePropertySocialPostsRequest = {}) {
  return queryOptions({
    queryKey: queryKeys.listings.socialPosts(propertyId, request),
    queryFn: () => generatePropertySocialPostDrafts(propertyId, request)
  });
}
