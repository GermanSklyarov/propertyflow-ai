import type { LeadPriority, LeadSource, LeadStatus, ListLeadsRequest } from "@propertyflow/contracts";

export const leadStatusFilterOptions: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];
export const leadPriorityFilterOptions: LeadPriority[] = ["low", "medium", "high"];
export const leadSourceFilterOptions: LeadSource[] = ["website", "public-api", "agent", "ai-chat", "ai-concierge", "saved-search", "social-post"];

export interface LeadQueueSearchParams {
  assignedAgentId?: string;
  attributionSocialPostTrackingSlug?: string;
  priority?: string;
  propertyId?: string;
  source?: string;
  status?: string;
  unassigned?: string;
}

export function parseLeadQueueRequest(query: LeadQueueSearchParams): ListLeadsRequest {
  return {
    assignedAgentId: query.assignedAgentId || undefined,
    attributionSocialPostTrackingSlug: query.attributionSocialPostTrackingSlug || undefined,
    limit: 24,
    priority: parseLeadPriority(query.priority),
    propertyId: query.propertyId || undefined,
    source: parseLeadSource(query.source),
    status: parseLeadStatus(query.status),
    unassigned: query.unassigned === "true" ? true : undefined
  };
}

export function buildActiveLeadFilterLabel(request: ListLeadsRequest) {
  if (request.attributionSocialPostTrackingSlug) {
    return `Social post: ${request.attributionSocialPostTrackingSlug}`;
  }

  if (request.propertyId) {
    return `Property: ${request.propertyId}`;
  }

  if (request.unassigned) {
    return "Unassigned leads";
  }

  if (request.assignedAgentId) {
    return `Agent: ${request.assignedAgentId}`;
  }

  if (request.status) {
    return `Status: ${request.status}`;
  }

  if (request.priority) {
    return `Priority: ${request.priority}`;
  }

  if (request.source) {
    return `Source: ${request.source}`;
  }

  return undefined;
}

export function buildLeadQueueHref(current: ListLeadsRequest, patch: Partial<ListLeadsRequest>) {
  const next: ListLeadsRequest = {
    ...current,
    ...patch,
    limit: undefined
  };
  const params = new URLSearchParams();

  Object.entries(next).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();

  return query ? `/leads?${query}` : "/leads";
}

function parseLeadStatus(value?: string): LeadStatus | undefined {
  return leadStatusFilterOptions.includes(value as LeadStatus) ? (value as LeadStatus) : undefined;
}

function parseLeadPriority(value?: string): LeadPriority | undefined {
  return leadPriorityFilterOptions.includes(value as LeadPriority) ? (value as LeadPriority) : undefined;
}

function parseLeadSource(value?: string): LeadSource | undefined {
  return leadSourceFilterOptions.includes(value as LeadSource) ? (value as LeadSource) : undefined;
}
