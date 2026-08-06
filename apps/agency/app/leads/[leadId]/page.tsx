import { notFound } from "next/navigation";
import { leadAgentsQueryOptions, leadDetailQueryOptions, leadNotesQueryOptions, leadTimelineQueryOptions } from "@entities/lead/api/lead-queries";
import { listingDetailQueryOptions, listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { currentTenantQueryOptions } from "@entities/tenant/api/tenant-queries";
import {
  parseLeadPropertyCandidateRequest,
  type LeadPropertyLinkSearchParams
} from "@features/lead-property-link/model/lead-property-link";
import { requireAgencySession } from "@shared/lib/tenant-session";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
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
  const { tenantId } = await requireAgencySession();
  const tenant = await queryClient.ensureQueryData(currentTenantQueryOptions(tenantId));
  const isCrmWorkspace = tenant.subscriptionPlan !== "starter";
  const [leadResult, timelineResult, notesResult, agentsResult] = await Promise.allSettled([
    queryClient.ensureQueryData(leadDetailQueryOptions(leadId)),
    queryClient.ensureQueryData(leadTimelineQueryOptions(leadId)),
    queryClient.ensureQueryData(leadNotesQueryOptions(leadId)),
    isCrmWorkspace ? queryClient.ensureQueryData(leadAgentsQueryOptions()) : Promise.resolve([])
  ]);

  if (leadResult.status === "rejected") {
    return (
      <PageLoadState
        kicker="Lead workspace unavailable"
        message={toErrorMessage(leadResult.reason)}
        title="Could not load lead"
        variant="error"
      />
    );
  }

  const lead = leadResult.value;

  if (!lead) {
    notFound();
  }

  const linkedListingResult = isCrmWorkspace && lead.propertyId
    ? await Promise.resolve(queryClient.ensureQueryData(listingDetailQueryOptions(lead.propertyId, tenantId))).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ reason, status: "rejected" as const })
      )
    : null;
  const listingCandidatesResult = !isCrmWorkspace || lead.propertyId
    ? null
    : await Promise.resolve(queryClient.ensureQueryData(listingsQueryOptions(listingCandidateRequest, tenantId))).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ reason, status: "rejected" as const })
      );
  const linkedListing = linkedListingResult?.status === "fulfilled" ? linkedListingResult.value : null;
  const listingCandidates = listingCandidatesResult?.status === "fulfilled" ? listingCandidatesResult.value : null;

  return (
    <LeadDetailPage
      agents={agentsResult.status === "fulfilled" ? agentsResult.value : []}
      agentsError={agentsResult.status === "rejected" ? toErrorMessage(agentsResult.reason) : undefined}
      lead={lead}
      linkedListingError={linkedListingResult?.status === "rejected" ? toErrorMessage(linkedListingResult.reason) : undefined}
      listingCandidates={listingCandidates}
      listingCandidatesError={
        listingCandidatesResult?.status === "rejected" ? toErrorMessage(listingCandidatesResult.reason) : undefined
      }
      linkedListing={linkedListing}
      notes={notesResult.status === "fulfilled" ? notesResult.value : undefined}
      notesError={notesResult.status === "rejected" ? toErrorMessage(notesResult.reason) : undefined}
      readOnly={tenant.subscriptionPlan === "starter"}
      timeline={timelineResult.status === "fulfilled" ? timelineResult.value : undefined}
      timelineError={timelineResult.status === "rejected" ? toErrorMessage(timelineResult.reason) : undefined}
    />
  );
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load lead workspace";
}
