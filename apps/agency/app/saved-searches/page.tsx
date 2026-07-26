import {
  savedSearchAlertAnalyticsQueryOptions,
  savedSearchesQueryOptions,
  savedSearchOpportunitiesQueryOptions
} from "@entities/saved-search/api/saved-search-queries";
import { currentTenantQueryOptions } from "@entities/tenant/api/tenant-queries";
import { getErrorMessage } from "@shared/lib/errors";
import { buildPlanAccessMessage, canAccessTenantPlan, crmTenantPlans } from "@shared/lib/tenant-plan-access";
import { requireAgencySession } from "@shared/lib/tenant-session";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { SavedSearchesPage } from "@views/saved-searches/ui/saved-searches-page";

export default async function AgencySavedSearchesPage() {
  const session = await requireAgencySession();
  const queryClient = createPropertyFlowQueryClient();
  const tenant = await queryClient.ensureQueryData(currentTenantQueryOptions(session.tenantId));

  if (!canAccessTenantPlan(tenant.subscriptionPlan, crmTenantPlans)) {
    return (
      <PageLoadState
        kicker="Growth feature"
        message={buildPlanAccessMessage("Saved searches")}
        title="Upgrade to unlock saved demand workflows"
        variant="notice"
      />
    );
  }

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
