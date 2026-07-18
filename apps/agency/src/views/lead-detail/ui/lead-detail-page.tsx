import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LeadPropertyLinkPanel } from "@features/lead-property-link/ui/lead-property-link-panel";
import { LeadWorkflowPanel } from "@features/lead-workflow-update/ui/lead-workflow-panel";
import type { LeadNotesResponse, LeadSnapshot, LeadTimelineResponse, PropertySearchResponse, TenantUserSnapshot } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket } from "@shared/lib/formatters";
import { LoadState } from "@shared/ui/load-state";
import { LeadActivityPanel } from "@widgets/lead-activity/ui/lead-activity-panel";
import { LeadOverviewPanel } from "@widgets/lead-overview/ui/lead-overview-panel";
import styles from "./lead-detail-page.module.css";

export function LeadDetailPage({
  agents,
  agentsError,
  lead,
  listingCandidates,
  listingCandidatesError,
  linkedListing,
  linkedListingError,
  notes,
  notesError,
  timeline,
  timelineError
}: {
  agents: TenantUserSnapshot[];
  agentsError?: string;
  lead: LeadSnapshot;
  listingCandidates: PropertySearchResponse | null;
  listingCandidatesError?: string;
  linkedListing?: PropertySnapshot | null;
  linkedListingError?: string;
  notes?: LeadNotesResponse;
  notesError?: string;
  timeline?: LeadTimelineResponse;
  timelineError?: string;
}) {
  const activityError = timelineError ?? notesError;

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

        {linkedListingError ? (
          <LoadState
            kicker="Linked listing unavailable"
            message={linkedListingError}
            title="Could not load linked property"
          />
        ) : null}

        {lead.propertyId || !listingCandidates ? null : <LeadPropertyLinkPanel leadId={lead.id} response={listingCandidates} />}

        {!lead.propertyId && listingCandidatesError ? (
          <LoadState
            kicker="Property picker unavailable"
            message={listingCandidatesError}
            title="Could not load listing candidates"
          />
        ) : null}

        {agentsError ? (
          <LoadState kicker="Agent roster unavailable" message={agentsError} title="Assignment options could not load" />
        ) : null}

        <LeadWorkflowPanel agents={agents} lead={lead} />

        {activityError || !notes || !timeline ? (
          <LoadState
            kicker="Activity unavailable"
            message={activityError ?? "Lead notes or timeline did not load."}
            title="Could not load lead activity"
          />
        ) : (
          <LeadActivityPanel leadId={lead.id} notes={notes} timeline={timeline} />
        )}
      </div>
    </main>
  );
}
