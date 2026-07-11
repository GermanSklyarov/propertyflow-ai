import {
  savedSearchAlertAnalyticsQueryOptions,
  savedSearchesQueryOptions,
  savedSearchOpportunitiesQueryOptions
} from "@entities/saved-search/api/saved-search-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { SavedSearchesPage } from "@views/saved-searches/ui/saved-searches-page";

export default async function AgencySavedSearchesPage() {
  const queryClient = createPropertyFlowQueryClient();
  const [savedSearches, opportunities, alertAnalytics] = await Promise.all([
    queryClient.ensureQueryData(savedSearchesQueryOptions()),
    queryClient.ensureQueryData(savedSearchOpportunitiesQueryOptions()),
    queryClient.ensureQueryData(savedSearchAlertAnalyticsQueryOptions())
  ]);

  return (
    <SavedSearchesPage
      alertAnalytics={alertAnalytics}
      opportunities={opportunities}
      savedSearches={savedSearches.items}
      total={savedSearches.total}
    />
  );
}
