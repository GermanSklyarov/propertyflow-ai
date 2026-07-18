import type { LeadQueueSummaryResponse, LeadSnapshot, ListLeadsRequest } from "@propertyflow/contracts";
import { formatDateTime } from "@shared/lib/formatters";
import { LoadState } from "@shared/ui/load-state";
import { LeadsQueuePanel } from "@widgets/leads-queue/ui/leads-queue-panel";
import styles from "./leads-page.module.css";

export function LeadsPage({
  activeFilterLabel,
  error,
  filters,
  leads,
  queueSummary,
  total
}: {
  activeFilterLabel?: string;
  error?: string;
  filters: ListLeadsRequest;
  leads?: LeadSnapshot[];
  queueSummary?: LeadQueueSummaryResponse;
  total?: number;
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
          <span className={styles.updated}>{queueSummary ? `Updated ${formatDateTime(queueSummary.generatedAt)}` : "Queue unavailable"}</span>
        </header>
        {activeFilterLabel ? (
          <div className={styles.activeFilter}>
            <span>Filtered queue</span>
            <strong>{activeFilterLabel}</strong>
            <a href="/leads">Clear filter</a>
          </div>
        ) : null}

        {leads && queueSummary && total !== undefined ? (
          <LeadsQueuePanel filters={filters} leads={leads} queueSummary={queueSummary} total={total} />
        ) : (
          <section className={styles.loadPanel} aria-label="Leads loading error">
            <LoadState
              kicker="CRM unavailable"
              message={error ?? "Backend is unavailable. Start the API server and retry."}
              title="Could not load leads"
            />
          </section>
        )}
      </div>
    </main>
  );
}
