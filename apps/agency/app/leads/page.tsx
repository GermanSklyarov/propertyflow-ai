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
  const [leadList, queueSummary] = await Promise.all([
    queryClient.ensureQueryData(leadsListQueryOptions(request)),
    queryClient.ensureQueryData(leadQueueSummaryQueryOptions(request))
  ]);

  return (
    <LeadsPage
      activeFilterLabel={buildActiveLeadFilterLabel(request)}
      filters={request}
      leads={leadList.items}
      queueSummary={queueSummary}
      total={leadList.total}
    />
  );
}
