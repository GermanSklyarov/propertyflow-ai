import type { LeadQueueSummaryResponse, LeadSnapshot, ListLeadsRequest } from "@propertyflow/contracts";
import { formatDateTime } from "@shared/lib/formatters";
import { LeadsQueuePanel } from "@widgets/leads-queue/ui/leads-queue-panel";
import styles from "./leads-page.module.css";

export function LeadsPage({
  activeFilterLabel,
  filters,
  leads,
  queueSummary,
  total
}: {
  activeFilterLabel?: string;
  filters: ListLeadsRequest;
  leads: LeadSnapshot[];
  queueSummary: LeadQueueSummaryResponse;
  total: number;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="section-kicker">CRM command queue</p>
            <h1 className={styles.title}>Leads that need action</h1>
            <p className={styles.subtitle}>
              Prioritize Concierge, saved-search, and website inquiries by ownership, SLA pressure, and buying intent.
            </p>
          </div>
          <span className={styles.updated}>Updated {formatDateTime(queueSummary.generatedAt)}</span>
        </header>
        {activeFilterLabel ? (
          <div className={styles.activeFilter}>
            <span>Filtered queue</span>
            <strong>{activeFilterLabel}</strong>
            <a href="/leads">Clear filter</a>
          </div>
        ) : null}

        <LeadsQueuePanel filters={filters} leads={leads} queueSummary={queueSummary} total={total} />
      </div>
    </main>
  );
}
