import { BellRing, Bot, Clock3, Filter, Flame, MailCheck, MapPin, Radar, Search, Sparkles, Target } from "lucide-react";
import type { ReactNode } from "react";
import type {
  SavedPropertySearchSnapshot,
  SavedSearchAlertAnalyticsResponse,
  SavedSearchOpportunityItem,
  SavedSearchOpportunitiesResponse
} from "@propertyflow/contracts";
import { formatBucket, formatDateTime } from "@shared/lib/formatters";
import styles from "./saved-searches-pipeline-panel.module.css";

export function SavedSearchesPipelinePanel({
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
    <>
      <section className={styles.kpiGrid} aria-label="Saved search overview">
        <KpiCard icon={<Search size={18} />} label="Saved searches" note={`${alertAnalytics.enabledAlerts} alerts enabled`} value={total} />
        <KpiCard icon={<Flame size={18} />} label="Hot opportunities" note="Score above 80" value={opportunities.summary.hotOpportunities} />
        <KpiCard icon={<Target size={18} />} label="Unconverted" note="No lead captured yet" value={opportunities.summary.unconvertedOpportunities} />
        <KpiCard icon={<MailCheck size={18} />} label="Alert candidates" note={`${alertAnalytics.recentRuns} recent runs`} value={alertAnalytics.totalCandidates} />
      </section>

      <section className={styles.layout}>
        <section className={styles.opportunityPanel} aria-label="Saved search opportunities">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Next best follow-up</p>
              <h2 className={styles.panelTitle}>Opportunity queue</h2>
            </div>
            <span className={styles.scoreBadge}>{opportunities.summary.averageOpportunityScore} avg score</span>
          </div>

          <div className={styles.opportunityList}>
            {opportunities.items.map((item) => (
              <OpportunityCard item={item} key={item.savedSearch.id} />
            ))}
          </div>
        </section>

        <aside className={styles.sidePanel}>
          <section className={styles.alertCard}>
            <p className="section-kicker">Alert engine</p>
            <h2 className={styles.sideTitle}>Digest health</h2>
            <div className={styles.alertGrid}>
              <Metric label="Enabled" value={alertAnalytics.enabledAlerts} />
              <Metric label="Completed" value={alertAnalytics.completedRuns} />
              <Metric label="Failed" value={alertAnalytics.failedRuns} />
              <Metric label="Avg candidates" value={alertAnalytics.averageCandidatesPerRun} />
            </div>
            {alertAnalytics.lastRun ? (
              <p className={styles.lastRun}>
                Last run: {alertAnalytics.lastRun.totalAlerts} alerts, {alertAnalytics.lastRun.totalCandidates} candidates ·{" "}
                {formatDateTime(alertAnalytics.lastRun.createdAt)}
              </p>
            ) : null}
          </section>
        </aside>
      </section>

      <section className={styles.searchPanel} aria-label="Saved searches list">
        <div className={styles.panelHeader}>
          <div>
            <p className="section-kicker">Watched demand</p>
            <h2 className={styles.panelTitle}>Search intents</h2>
          </div>
          <span className={styles.scoreBadge}>{savedSearches.filter((search) => search.notificationsEnabled).length} active alerts</span>
        </div>

        <div className={styles.searchList}>
          {savedSearches.map((savedSearch) => (
            <SavedSearchRow key={savedSearch.id} savedSearch={savedSearch} />
          ))}
        </div>
      </section>
    </>
  );
}

function OpportunityCard({ item }: { item: SavedSearchOpportunityItem }) {
  return (
    <article className={styles.opportunityCard}>
      <div className={styles.opportunityTop}>
        <div>
          <h3>{item.savedSearch.title}</h3>
          <p>{item.reason}</p>
        </div>
        <span className={styles.hotScore}>{item.opportunityScore}</span>
      </div>

      <div className={styles.badgeRow}>
        <span>
          <Radar size={14} />
          {item.currentMatchCount} matches
        </span>
        <span>
          <BellRing size={14} />
          {item.leadCount} leads
        </span>
        {item.latestLeadAt ? (
          <span>
            <Clock3 size={14} />
            {formatDateTime(item.latestLeadAt)}
          </span>
        ) : (
          <span>
            <Sparkles size={14} />
            no lead yet
          </span>
        )}
      </div>

      {item.topRecommendation ? (
        <div className={styles.recommendation}>
          <span className="section-kicker">Top match</span>
          <strong>{item.topRecommendation.property.title}</strong>
          <p>{item.topRecommendation.reasons[0]}</p>
        </div>
      ) : null}
    </article>
  );
}

function SavedSearchRow({ savedSearch }: { savedSearch: SavedPropertySearchSnapshot }) {
  return (
    <article className={styles.searchRow}>
      <div>
        <h3>{savedSearch.title}</h3>
        <p>{savedSearch.naturalLanguageQuery ?? "Structured search without natural-language prompt."}</p>
      </div>

      <div className={styles.filterGroup}>
        <span>
          <MapPin size={14} />
          {savedSearch.filters.market ?? "all markets"}
        </span>
        <span>
          <Filter size={14} />
          {savedSearch.filters.listingType ? formatBucket(savedSearch.filters.listingType) : "any intent"}
        </span>
        <span>
          <Bot size={14} />
          {savedSearch.purpose ?? "general"}
        </span>
      </div>

      <div className={styles.searchStats}>
        <strong>{savedSearch.matchCount}</strong>
        <span>matches</span>
        <small className={savedSearch.notificationsEnabled ? styles.alertOn : styles.alertOff}>
          {savedSearch.notificationsEnabled ? "alerts on" : "alerts off"}
        </small>
      </div>
    </article>
  );
}

function KpiCard({
  icon,
  label,
  note,
  value
}: {
  icon: ReactNode;
  label: string;
  note: string;
  value: number | string;
}) {
  return (
    <article className={styles.kpiCard}>
      <div className={styles.kpiIcon}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.metric}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
