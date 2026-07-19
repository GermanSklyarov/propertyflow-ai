import {
  savedSearchAlertAnalyticsQueryOptions,
  savedSearchesQueryOptions,
  savedSearchOpportunitiesQueryOptions
} from "@entities/saved-search/api/saved-search-queries";
import { getErrorMessage } from "@shared/lib/errors";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { SavedSearchesPage } from "@views/saved-searches/ui/saved-searches-page";

export default async function AgencySavedSearchesPage() {
  const queryClient = createPropertyFlowQueryClient();

  try {
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
  } catch (error) {
    return (
      <PageLoadState
        kicker="Saved searches"
        message={getErrorMessage(error)}
        title="Could not load saved search pipeline"
        variant="error"
      />
    );
  }
}
