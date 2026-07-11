import { leadQueueSummaryQueryOptions, leadsListQueryOptions } from "@entities/lead/api/lead-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { LeadsPage } from "@views/leads/ui/leads-page";

export default async function AgencyLeadsPage() {
  const queryClient = createPropertyFlowQueryClient();
  const [leadList, queueSummary] = await Promise.all([
    queryClient.ensureQueryData(leadsListQueryOptions()),
    queryClient.ensureQueryData(leadQueueSummaryQueryOptions())
  ]);

  return <LeadsPage leads={leadList.items} queueSummary={queueSummary} total={leadList.total} />;
}
