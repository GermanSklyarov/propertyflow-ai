import type { ListLeadsRequest } from "@propertyflow/contracts";
import { queryOptions } from "@tanstack/react-query";
import { getLeadQueueSummary, listLeads } from "@shared/api/agency-client";
import { queryKeys } from "@shared/query/query-keys";

const defaultLeadQueueRequest = { limit: 24 } satisfies ListLeadsRequest;

export function leadsListQueryOptions(request: ListLeadsRequest = defaultLeadQueueRequest) {
  return queryOptions({
    queryKey: queryKeys.leads.list(request),
    queryFn: () => listLeads(request)
  });
}

export function leadQueueSummaryQueryOptions(request: ListLeadsRequest = defaultLeadQueueRequest) {
  return queryOptions({
    queryKey: queryKeys.leads.queueSummary(request),
    queryFn: () => getLeadQueueSummary(request)
  });
}
