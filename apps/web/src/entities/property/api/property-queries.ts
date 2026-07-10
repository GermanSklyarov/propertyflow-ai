import { queryOptions } from "@tanstack/react-query";
import { getPropertyById, listFeaturedProperties } from "../../../shared/api/propertyflow-client";
import { queryKeys } from "../../../shared/query/query-keys";

export function featuredPropertiesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.properties.featured(),
    queryFn: listFeaturedProperties
  });
}

export function propertyDetailQueryOptions(propertyId: string) {
  return queryOptions({
    queryKey: queryKeys.properties.detail(propertyId),
    queryFn: () => getPropertyById(propertyId)
  });
}
