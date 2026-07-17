import { leadQueueSummaryQueryOptions, leadsListQueryOptions } from "@entities/lead/api/lead-queries";
import type { LeadSource, ListLeadsRequest } from "@propertyflow/contracts";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { LeadsPage } from "@views/leads/ui/leads-page";

export default async function AgencyLeadsPage({
  searchParams
}: {
  searchParams: Promise<{
    attributionSocialPostTrackingSlug?: string;
    propertyId?: string;
    source?: string;
  }>;
}) {
  const query = await searchParams;
  const request = parseLeadQueueRequest(query);
  const queryClient = createPropertyFlowQueryClient();
  const [leadList, queueSummary] = await Promise.all([
    queryClient.ensureQueryData(leadsListQueryOptions(request)),
    queryClient.ensureQueryData(leadQueueSummaryQueryOptions(request))
  ]);

  return <LeadsPage activeFilterLabel={buildActiveFilterLabel(request)} leads={leadList.items} queueSummary={queueSummary} total={leadList.total} />;
}

function parseLeadQueueRequest(query: {
  attributionSocialPostTrackingSlug?: string;
  propertyId?: string;
  source?: string;
}): ListLeadsRequest {
  return {
    attributionSocialPostTrackingSlug: query.attributionSocialPostTrackingSlug || undefined,
    limit: 24,
    propertyId: query.propertyId || undefined,
    source: parseLeadSource(query.source)
  };
}

function parseLeadSource(value?: string): LeadSource | undefined {
  return value === "website" ||
    value === "public-api" ||
    value === "agent" ||
    value === "ai-chat" ||
    value === "ai-concierge" ||
    value === "saved-search" ||
    value === "social-post"
    ? value
    : undefined;
}

function buildActiveFilterLabel(request: ListLeadsRequest) {
  if (request.attributionSocialPostTrackingSlug) {
    return `Social post: ${request.attributionSocialPostTrackingSlug}`;
  }

  if (request.propertyId) {
    return `Property: ${request.propertyId}`;
  }

  if (request.source) {
    return `Source: ${request.source}`;
  }

  return undefined;
}
