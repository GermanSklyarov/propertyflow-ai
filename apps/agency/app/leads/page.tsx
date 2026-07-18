import { leadQueueSummaryQueryOptions, leadsListQueryOptions } from "@entities/lead/api/lead-queries";
import { buildActiveLeadFilterLabel, parseLeadQueueRequest, type LeadQueueSearchParams } from "@entities/lead/model/lead-filters";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { LeadsPage } from "@views/leads/ui/leads-page";

export default async function AgencyLeadsPage({
  searchParams
}: {
  searchParams: Promise<LeadQueueSearchParams>;
}) {
  const query = await searchParams;
  const request = parseLeadQueueRequest(query);
  const queryClient = createPropertyFlowQueryClient();
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
