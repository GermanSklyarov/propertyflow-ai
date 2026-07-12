import { notFound } from "next/navigation";
import { leadDetailQueryOptions, leadNotesQueryOptions, leadTimelineQueryOptions } from "@entities/lead/api/lead-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { LeadDetailPage } from "@views/lead-detail/ui/lead-detail-page";

export default async function AgencyLeadDetailRoute({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const queryClient = createPropertyFlowQueryClient();
  const [lead, timeline, notes] = await Promise.all([
    queryClient.ensureQueryData(leadDetailQueryOptions(leadId)),
    queryClient.ensureQueryData(leadTimelineQueryOptions(leadId)),
    queryClient.ensureQueryData(leadNotesQueryOptions(leadId))
  ]);

  if (!lead) {
    notFound();
  }

  return <LeadDetailPage lead={lead} notes={notes} timeline={timeline} />;
}
