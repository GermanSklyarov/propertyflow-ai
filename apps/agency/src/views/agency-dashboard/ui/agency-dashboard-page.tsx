import type { TenantDashboardMetrics } from "@propertyflow/contracts";
import { formatDateTime } from "@shared/lib/formatters";
import { AgencyCommandCenterPanel } from "@widgets/agency-command-center/ui/agency-command-center-panel";
import styles from "./agency-dashboard-page.module.css";

export function AgencyDashboardPage({ metrics }: { metrics: TenantDashboardMetrics }) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <p className="section-kicker">Agency operations</p>
            <h1 className={styles.title}>PropertyFlow command center</h1>
            <p className={styles.subtitle}>
              One operating view for listings, AI Concierge, saved-search
              follow-up, lead health, and security signals.
            </p>
          </div>
          <span className={styles.timestamp}>
            Updated {formatDateTime(metrics.generatedAt)}
          </span>
        </header>

        <AgencyCommandCenterPanel metrics={metrics} />
      </div>
    </main>
  );
}
