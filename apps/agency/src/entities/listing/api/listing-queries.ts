import type { GeneratePropertySocialPostsRequest, PropertySearchRequest } from "@propertyflow/contracts";
import { queryOptions } from "@tanstack/react-query";
import {
  generatePropertySocialPostDrafts,
  listPropertySocialPostPublications,
  listPropertySocialPostReviews,
  getProperty,
  getPropertyAiAssets,
  getPropertyImages,
  listProperties
} from "@shared/api/agency-client";
import { queryKeys } from "@shared/query/query-keys";

const defaultListingRequest = { limit: 30, sort: "created-desc" } satisfies PropertySearchRequest;

export function listingsQueryOptions(request: PropertySearchRequest = defaultListingRequest, tenantId?: string) {
  return queryOptions({
    queryKey: queryKeys.listings.list(request, tenantId),
    queryFn: () => listProperties(request, { tenantId })
  });
}

export function listingDetailQueryOptions(propertyId: string, tenantId?: string) {
  return queryOptions({
    queryKey: queryKeys.listings.detail(propertyId, tenantId),
    queryFn: () => getProperty(propertyId, { tenantId })
  });
}

export function listingImagesQueryOptions(propertyId: string, tenantId?: string) {
  return queryOptions({
    queryKey: queryKeys.listings.images(propertyId, tenantId),
    queryFn: () => getPropertyImages(propertyId, { tenantId })
  });
}

export function listingAiAssetsQueryOptions(propertyId: string, tenantId?: string) {
  return queryOptions({
    queryKey: queryKeys.listings.aiAssets(propertyId, tenantId),
    queryFn: () => getPropertyAiAssets(propertyId, { tenantId })
  });
}

export function listingSocialPostsQueryOptions(propertyId: string, request: GeneratePropertySocialPostsRequest = {}) {
  return queryOptions({
    queryKey: queryKeys.listings.socialPosts(propertyId, request),
    queryFn: () => generatePropertySocialPostDrafts(propertyId, request)
  });
}

export function listingSocialPostPublicationsQueryOptions(propertyId: string) {
  return queryOptions({
    queryKey: [...queryKeys.listings.socialPosts(propertyId, {}), "publications"],
    queryFn: () => listPropertySocialPostPublications(propertyId)
  });
}

export function listingSocialPostReviewsQueryOptions(propertyId: string) {
  return queryOptions({
    queryKey: [...queryKeys.listings.socialPosts(propertyId, {}), "reviews"],
    queryFn: () => listPropertySocialPostReviews(propertyId)
  });
}
