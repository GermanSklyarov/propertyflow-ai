import type { LeadListSort, LeadPriority, LeadSource, LeadStatus, ListLeadsRequest } from "@propertyflow/contracts";

export const leadStatusFilterOptions: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];
export const leadPriorityFilterOptions: LeadPriority[] = ["low", "medium", "high"];
export const leadSourceFilterOptions: LeadSource[] = ["website", "public-api", "agent", "ai-chat", "ai-concierge", "saved-search", "social-post"];
export const leadSortFilterOptions: LeadListSort[] = ["follow-up-asc", "created-desc", "created-asc", "priority-desc"];
export const leadQueuePageSize = 12;

export interface LeadQueueSearchParams {
  assignedAgentId?: string;
  attributionSocialPostTrackingSlug?: string;
  priority?: string;
  propertyId?: string;
  page?: string;
  source?: string;
  sort?: string;
  status?: string;
  unassigned?: string;
}

export function parseLeadQueueRequest(query: LeadQueueSearchParams): ListLeadsRequest {
  return {
    assignedAgentId: query.assignedAgentId || undefined,
    attributionSocialPostTrackingSlug: query.attributionSocialPostTrackingSlug || undefined,
    limit: leadQueuePageSize,
    offset: (parseLeadQueuePage(query.page) - 1) * leadQueuePageSize,
    priority: parseLeadPriority(query.priority),
    propertyId: query.propertyId || undefined,
    source: parseLeadSource(query.source),
    sort: parseLeadSort(query.sort) ?? "follow-up-asc",
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

type LeadQueueHrefPatch = Partial<ListLeadsRequest> & { page?: number };

export function buildLeadQueueHref(current: ListLeadsRequest, patch: LeadQueueHrefPatch) {
  const { page, ...requestPatch } = patch;
  const next: ListLeadsRequest = {
    ...current,
    ...requestPatch,
    limit: undefined,
    offset: undefined
  };
  const params = new URLSearchParams();

  Object.entries(next).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  if (page && page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return query ? `/leads?${query}` : "/leads";
}

export function getLeadQueuePage(request: ListLeadsRequest) {
  return Math.floor((request.offset ?? 0) / (request.limit ?? leadQueuePageSize)) + 1;
}

export function formatLeadSort(sort: NonNullable<ListLeadsRequest["sort"]>) {
  const labels = {
    "created-asc": "Oldest first",
    "created-desc": "Newest first",
    "follow-up-asc": "Follow-up due first",
    "priority-desc": "Priority first"
  } satisfies Record<NonNullable<ListLeadsRequest["sort"]>, string>;

  return labels[sort];
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

function parseLeadSort(value?: string): LeadListSort | undefined {
  return leadSortFilterOptions.includes(value as LeadListSort) ? (value as LeadListSort) : undefined;
}

function parseLeadQueuePage(value?: string) {
  const page = Number(value);

  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}
