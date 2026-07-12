import { queryOptions } from "@tanstack/react-query";
import {
  getPropertyById,
  getPropertyImages,
  listFeaturedProperties,
  type FeaturedPropertiesRequest
} from "@shared/api/propertyflow-client";
import { queryKeys } from "@shared/query/query-keys";

export function featuredPropertiesQueryOptions(request?: FeaturedPropertiesRequest) {
  return queryOptions({
    queryKey: queryKeys.properties.featured(request),
    queryFn: () => listFeaturedProperties(request)
  });
}

export function propertyDetailQueryOptions(propertyId: string) {
  return queryOptions({
    queryKey: queryKeys.properties.detail(propertyId),
    queryFn: () => getPropertyById(propertyId)
  });
}

export function propertyImagesQueryOptions(propertyId: string) {
  return queryOptions({
    queryKey: queryKeys.properties.images(propertyId),
    queryFn: () => getPropertyImages(propertyId)
  });
}
