import { notFound } from "next/navigation";
import { leadAgentsQueryOptions, leadDetailQueryOptions, leadNotesQueryOptions, leadTimelineQueryOptions } from "@entities/lead/api/lead-queries";
import { listingDetailQueryOptions, listingsQueryOptions } from "@entities/listing/api/listing-queries";
import {
  parseLeadPropertyCandidateRequest,
  type LeadPropertyLinkSearchParams
} from "@features/lead-property-link/model/lead-property-link";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { LeadDetailPage } from "@views/lead-detail/ui/lead-detail-page";

export default async function AgencyLeadDetailRoute({
  params,
  searchParams
}: {
  params: Promise<{ leadId: string }>;
  searchParams?: Promise<LeadPropertyLinkSearchParams>;
}) {
  const { leadId } = await params;
  const query = (await searchParams) ?? {};
  const listingCandidateRequest = parseLeadPropertyCandidateRequest(query);
  const queryClient = createPropertyFlowQueryClient();
  const [lead, timeline, notes, agents] = await Promise.all([
    queryClient.ensureQueryData(leadDetailQueryOptions(leadId)),
    queryClient.ensureQueryData(leadTimelineQueryOptions(leadId)),
    queryClient.ensureQueryData(leadNotesQueryOptions(leadId)),
    queryClient.ensureQueryData(leadAgentsQueryOptions())
  ]);

  if (!lead) {
    notFound();
  }

  const linkedListing = lead.propertyId ? await queryClient.ensureQueryData(listingDetailQueryOptions(lead.propertyId)) : null;
  const listingCandidates = lead.propertyId
    ? null
    : await queryClient.ensureQueryData(listingsQueryOptions(listingCandidateRequest));

  return (
    <LeadDetailPage
      agents={agents}
      lead={lead}
      listingCandidates={listingCandidates}
      linkedListing={linkedListing}
      notes={notes}
      timeline={timeline}
    />
  );
}
