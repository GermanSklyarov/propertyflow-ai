import type { ListLeadsRequest } from "@propertyflow/contracts";
import { queryOptions } from "@tanstack/react-query";
import { getLead, getLeadNotes, getLeadQueueSummary, getLeadTimeline, listLeadAgents, listLeads } from "@shared/api/agency-client";
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

export function leadDetailQueryOptions(leadId: string) {
  return queryOptions({
    queryKey: queryKeys.leads.detail(leadId),
    queryFn: () => getLead(leadId)
  });
}

export function leadTimelineQueryOptions(leadId: string) {
  return queryOptions({
    queryKey: queryKeys.leads.timeline(leadId),
    queryFn: () => getLeadTimeline(leadId)
  });
}

export function leadNotesQueryOptions(leadId: string) {
  return queryOptions({
    queryKey: queryKeys.leads.notes(leadId),
    queryFn: () => getLeadNotes(leadId)
  });
}

export function leadAgentsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.leads.agents(),
    queryFn: () => listLeadAgents()
  });
}
