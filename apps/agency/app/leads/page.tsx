import { leadQueueSummaryQueryOptions, leadsListQueryOptions } from "@entities/lead/api/lead-queries";
import { currentTenantQueryOptions } from "@entities/tenant/api/tenant-queries";
import { buildActiveLeadFilterLabel, parseLeadQueueRequest, type LeadQueueSearchParams } from "@entities/lead/model/lead-filters";
import { buildPlanAccessMessage, canAccessTenantPlan, crmTenantPlans } from "@shared/lib/tenant-plan-access";
import { requireAgencySession } from "@shared/lib/tenant-session";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
import { LeadsPage } from "@views/leads/ui/leads-page";

export default async function AgencyLeadsPage({
  searchParams
}: {
  searchParams: Promise<LeadQueueSearchParams>;
}) {
  const query = await searchParams;
  const request = parseLeadQueueRequest(query);
  const session = await requireAgencySession();
  const queryClient = createPropertyFlowQueryClient();
  const tenant = await queryClient.ensureQueryData(currentTenantQueryOptions(session.tenantId));

  if (!canAccessTenantPlan(tenant.subscriptionPlan, crmTenantPlans)) {
    return (
      <PageLoadState
        kicker="Growth feature"
        message={buildPlanAccessMessage("Lead queue")}
        title="Upgrade to unlock CRM lead work"
        variant="notice"
      />
    );
  }

  const [leadListResult, queueSummaryResult] = await Promise.allSettled([
    queryClient.ensureQueryData(leadsListQueryOptions(request)),
    queryClient.ensureQueryData(leadQueueSummaryQueryOptions(request))
  ]);
  const leadList = leadListResult.status === "fulfilled" ? leadListResult.value : undefined;
  const queueSummary = queueSummaryResult.status === "fulfilled" ? queueSummaryResult.value : undefined;
  const loadError =
    leadListResult.status === "rejected"
      ? toErrorMessage(leadListResult.reason)
      : queueSummaryResult.status === "rejected"
        ? toErrorMessage(queueSummaryResult.reason)
        : undefined;

  return (
    <LeadsPage
      activeFilterLabel={buildActiveLeadFilterLabel(request)}
      error={loadError}
      filters={request}
      leads={leadList?.items}
      queueSummary={queueSummary}
      total={leadList?.total}
    />
  );
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load leads";
}
