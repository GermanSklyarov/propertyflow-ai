import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { LeadNotesResponse, LeadSnapshot, LeadTimelineResponse } from "@propertyflow/contracts";
import { formatBucket } from "@shared/lib/formatters";
import { LeadActivityPanel } from "@widgets/lead-activity/ui/lead-activity-panel";
import { LeadOverviewPanel } from "@widgets/lead-overview/ui/lead-overview-panel";
import styles from "./lead-detail-page.module.css";

export function LeadDetailPage({
  lead,
  notes,
  timeline
}: {
  lead: LeadSnapshot;
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

        <LeadOverviewPanel lead={lead} />

        <LeadActivityPanel notes={notes} timeline={timeline} />
      </div>
    </main>
  );
}
