import { queryOptions } from "@tanstack/react-query";
import {
  getSavedSearchAlertAnalytics,
  listSavedPropertySearches,
  listSavedSearchOpportunities
} from "@shared/api/agency-client";
import { queryKeys } from "@shared/query/query-keys";

export function savedSearchesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.savedSearches.list(),
    queryFn: () => listSavedPropertySearches()
  });
}

export function savedSearchOpportunitiesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.savedSearches.opportunities(),
    queryFn: () => listSavedSearchOpportunities()
  });
}

export function savedSearchAlertAnalyticsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.savedSearches.alertAnalytics(),
    queryFn: () => getSavedSearchAlertAnalytics()
  });
}
