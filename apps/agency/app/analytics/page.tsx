import { tenantDashboardQueryOptions } from "@entities/analytics/api/analytics-queries";
import { currentTenantQueryOptions } from "@entities/tenant/api/tenant-queries";
import { buildPlanAccessMessage, canAccessTenantPlan, crmTenantPlans } from "@shared/lib/tenant-plan-access";
import { requireAgencySession } from "@shared/lib/tenant-session";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { AnalyticsPage } from "@views/analytics/ui/analytics-page";

export default async function AgencyAnalyticsPage() {
  const session = await requireAgencySession();
  const queryClient = createPropertyFlowQueryClient();
  const tenant = await queryClient.ensureQueryData(currentTenantQueryOptions(session.tenantId));

  if (!canAccessTenantPlan(tenant.subscriptionPlan, crmTenantPlans)) {
    return (
      <PageLoadState
        kicker="Growth feature"
        message={buildPlanAccessMessage("Analytics")}
        title="Upgrade to unlock CRM analytics"
        variant="notice"
      />
    );
  }

  const metrics = await queryClient.ensureQueryData(tenantDashboardQueryOptions());

  return <AnalyticsPage metrics={metrics} />;
}
