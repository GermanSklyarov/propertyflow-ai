import type {
  SavedPropertySearchSnapshot,
  SavedSearchAlertAnalyticsResponse,
  SavedSearchOpportunitiesResponse
} from "@propertyflow/contracts";
import { formatDateTime } from "@shared/lib/formatters";
import { SavedSearchesPipelinePanel } from "@widgets/saved-searches-pipeline/ui/saved-searches-pipeline-panel";
import styles from "./saved-searches-page.module.css";

export function SavedSearchesPage({
  alertAnalytics,
  opportunities,
  savedSearches,
  total
}: {
  alertAnalytics: SavedSearchAlertAnalyticsResponse;
  opportunities: SavedSearchOpportunitiesResponse;
  savedSearches: SavedPropertySearchSnapshot[];
  total: number;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="section-kicker">AI search follow-up</p>
            <h1 className={styles.title}>Saved searches pipeline</h1>
            <p className={styles.subtitle}>
              Turn buyer and renter intent into alert digests, curated matches, lead coverage, and agent follow-up.
            </p>
          </div>
          <span className={styles.timestamp}>Updated {formatDateTime(opportunities.generatedAt)}</span>
        </header>

        <SavedSearchesPipelinePanel
          alertAnalytics={alertAnalytics}
          opportunities={opportunities}
          savedSearches={savedSearches}
          total={total}
        />
      </div>
    </main>
  );
}
