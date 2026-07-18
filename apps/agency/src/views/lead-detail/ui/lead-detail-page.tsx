import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LeadPropertyLinkPanel } from "@features/lead-property-link/ui/lead-property-link-panel";
import { LeadWorkflowPanel } from "@features/lead-workflow-update/ui/lead-workflow-panel";
import type { LeadNotesResponse, LeadSnapshot, LeadTimelineResponse, TenantUserSnapshot } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket } from "@shared/lib/formatters";
import { LeadActivityPanel } from "@widgets/lead-activity/ui/lead-activity-panel";
import { LeadOverviewPanel } from "@widgets/lead-overview/ui/lead-overview-panel";
import styles from "./lead-detail-page.module.css";

export function LeadDetailPage({
  agents,
  lead,
  listingSearch,
  linkableListings,
  linkedListing,
  notes,
  timeline
}: {
  agents: TenantUserSnapshot[];
  lead: LeadSnapshot;
  listingSearch: string;
  linkableListings: PropertySnapshot[];
  linkedListing?: PropertySnapshot | null;
  notes: LeadNotesResponse;
  timeline: LeadTimelineResponse;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/leads">
              <ArrowLeft size={16} />
              Back to leads
            </Link>
            <p className="section-kicker">Lead workspace</p>
            <h1 className={styles.title}>{lead.contactName}</h1>
            <p className={styles.subtitle}>{lead.message ?? "No message yet. Review context and assign next action."}</p>
          </div>
          <span className={styles.statusBadge}>{formatBucket(lead.status)}</span>
        </header>

        <LeadOverviewPanel lead={lead} linkedListing={linkedListing} />

        {lead.propertyId ? null : <LeadPropertyLinkPanel leadId={lead.id} listings={linkableListings} searchQuery={listingSearch} />}

        <LeadWorkflowPanel agents={agents} lead={lead} />

        <LeadActivityPanel leadId={lead.id} notes={notes} timeline={timeline} />
      </div>
    </main>
  );
}
