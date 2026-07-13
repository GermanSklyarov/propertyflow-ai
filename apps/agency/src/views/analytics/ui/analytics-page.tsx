import type { TenantDashboardMetrics } from "@propertyflow/contracts";
import { formatDateTime } from "@shared/lib/formatters";
import { AgencyAnalyticsPanel } from "@widgets/agency-analytics/ui/agency-analytics-panel";
import styles from "./analytics-page.module.css";

export function AnalyticsPage({ metrics }: { metrics: TenantDashboardMetrics }) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="section-kicker">Performance analytics</p>
            <h1 className={styles.title}>Agency growth signals</h1>
            <p className={styles.subtitle}>
              Track where demand comes from, how AI-assisted search converts, and where agents need to improve response quality.
            </p>
          </div>
          <span className={styles.timestamp}>Updated {formatDateTime(metrics.generatedAt)}</span>
        </header>

        <AgencyAnalyticsPanel metrics={metrics} />
      </div>
    </main>
  );
}
