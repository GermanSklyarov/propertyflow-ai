import { notFound } from "next/navigation";
import { leadAgentsQueryOptions, leadDetailQueryOptions, leadNotesQueryOptions, leadTimelineQueryOptions } from "@entities/lead/api/lead-queries";
import { listingDetailQueryOptions, listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { LeadDetailPage } from "@views/lead-detail/ui/lead-detail-page";

export default async function AgencyLeadDetailRoute({
  params,
  searchParams
}: {
  params: Promise<{ leadId: string }>;
  searchParams?: Promise<{ listingSearch?: string }>;
}) {
  const { leadId } = await params;
  const query = (await searchParams) ?? {};
  const listingSearch = query.listingSearch?.trim() ?? "";
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
  const linkableListings = lead.propertyId
    ? []
    : (await queryClient.ensureQueryData(listingsQueryOptions({ limit: 12, query: listingSearch || undefined, sort: "created-desc" }))).items;

  return (
    <LeadDetailPage
      agents={agents}
      lead={lead}
      listingSearch={listingSearch}
      linkableListings={linkableListings}
      linkedListing={linkedListing}
      notes={notes}
      timeline={timeline}
    />
  );
}
