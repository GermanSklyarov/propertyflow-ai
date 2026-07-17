import { notFound } from "next/navigation";
import { leadAgentsQueryOptions, leadDetailQueryOptions, leadNotesQueryOptions, leadTimelineQueryOptions } from "@entities/lead/api/lead-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { LeadDetailPage } from "@views/lead-detail/ui/lead-detail-page";

export default async function AgencyLeadDetailRoute({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
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

  return <LeadDetailPage agents={agents} lead={lead} notes={notes} timeline={timeline} />;
}
