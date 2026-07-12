import {
  Activity,
  Bot,
  ChartNoAxesCombined,
  CircleAlert,
  Clock3,
  Compass,
  Gauge,
  ListFilter,
  Search,
  ShieldCheck,
  Target,
  Users
} from "lucide-react";
import type { CountByBucket, TenantDashboardMetrics } from "@propertyflow/contracts";
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

        <section className={styles.kpiGrid} aria-label="Agency analytics overview">
          <KpiCard icon={<Search size={18} />} label="Searches" note={`${metrics.attributedLeads} attributed leads`} value={metrics.totalSearches} />
          <KpiCard icon={<Users size={18} />} label="Lead conversion" note={`${metrics.wonLeads} won / ${metrics.lostLeads} lost`} value={formatPercent(metrics.conversionRate)} />
          <KpiCard icon={<Bot size={18} />} label="Concierge conversion" note={`${metrics.conciergeLeads} leads`} value={formatPercent(metrics.conciergeLeadConversionRate)} />
          <KpiCard icon={<Clock3 size={18} />} label="SLA health" note={`${metrics.leadSlaResponseDueSoon} due soon`} value={`${metrics.leadSlaHealthScore}/100`} />
        </section>

        <section className={styles.funnelPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Conversion system</p>
              <h2 className={styles.panelTitle}>Search to lead funnel</h2>
            </div>
            <span className={styles.badge}>{formatPercent(metrics.searchToLeadConversionRate)} search-to-lead</span>
          </div>

          <div className={styles.funnelGrid}>
            <FunnelStep icon={<Search size={18} />} label="Total searches" value={metrics.totalSearches} />
            <FunnelStep icon={<ListFilter size={18} />} label="Attributed leads" value={metrics.attributedLeads} />
            <FunnelStep icon={<Users size={18} />} label="Total leads" value={metrics.totalLeads} />
            <FunnelStep icon={<Gauge size={18} />} label="Won leads" value={metrics.wonLeads} />
          </div>
        </section>

        <section className={styles.layout}>
          <Panel icon={<Bot size={20} />} kicker="AI Concierge" title="Consultation quality">
            <MetricTiles
              items={[
                { label: "Sessions", value: metrics.conciergeSessions },
                { label: "Recommended", value: metrics.conciergeRecommendedSessions },
                { label: "Awaiting input", value: metrics.conciergeAwaitingInputSessions },
                { label: "Positive feedback", value: formatPercent(metrics.conciergePositiveFeedbackRate) }
              ]}
            />
            <BucketList items={metrics.conciergeRecommendationsByArea} title="Recommended areas" />
            <BucketList items={metrics.conciergeFeedbackByRating} title="Feedback mix" />
          </Panel>

          <Panel icon={<Compass size={20} />} kicker="Saved search" title="Follow-up engine">
            <MetricTiles
              items={[
                { label: "Saved searches", value: metrics.savedSearches },
                { label: "Matched properties", value: metrics.savedSearchMatchedProperties },
                { label: "Open opportunities", value: metrics.savedSearchOpenOpportunities },
                { label: "Coverage", value: formatPercent(metrics.savedSearchLeadCoverageRate) }
              ]}
            />
            <div className={styles.callout}>
              <strong>{formatPercent(metrics.savedSearchFollowUpCompletionRate)}</strong>
              <span>follow-up completion</span>
            </div>
          </Panel>
        </section>

        <section className={styles.layout}>
          <Panel icon={<Activity size={20} />} kicker="Lead operations" title="SLA and quality">
            <MetricTiles
              items={[
                { label: "Avg first response", value: metrics.leadSlaAverageFirstResponseHours ? `${metrics.leadSlaAverageFirstResponseHours}h` : "n/a" },
                { label: "Overdue follow-ups", value: metrics.leadSlaOverdueFollowUps },
                { label: "Quality health", value: `${metrics.leadQualityHealthScore}/100` },
                { label: "Issues", value: metrics.leadQualityIssueCount }
              ]}
            />
            <BucketList items={metrics.leadQualityByIssue} title="Quality issues" />
            <BucketList items={metrics.leadSlaBreachedBySource} title="SLA breaches by source" />
          </Panel>

          <Panel icon={<ShieldCheck size={20} />} kicker="Guardrails" title="AI action safety">
            <MetricTiles
              items={[
                { label: "Blocked actions", value: metrics.security.blockedAiActions },
                { label: "Delete previews", value: metrics.security.imageDeletePreviews },
                { label: "Image removals", value: metrics.security.imageRemovals },
                { label: "Rejected jobs", value: metrics.security.rejectedJobEnqueues }
              ]}
            />
            <BucketList items={metrics.security.blockedAiActionsByName} title="Blocked action mix" />
            <BucketList items={metrics.security.rejectedJobsByName} title="Rejected jobs" />
          </Panel>
        </section>

        <section className={styles.layout}>
          <Panel icon={<ChartNoAxesCombined size={20} />} kicker="Channel mix" title="Demand by source">
            <BucketList items={metrics.searchesBySource} title="Searches by source" />
            <BucketList items={metrics.leadsBySource} title="Leads by source" />
            <BucketList items={metrics.leadsByStatus} title="Leads by status" />
          </Panel>

          <Panel icon={<CircleAlert size={20} />} kicker="Intent intelligence" title="Top search demand">
            <BucketList items={metrics.topSearchQueries} title="Top searches" />
            <BucketList items={metrics.topLeadSearchQueries} title="Lead-generating queries" />
            <BucketList items={metrics.leadsByAttributedSearchSource} title="Attributed lead sources" />
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({
  children,
  icon,
  kicker,
  title
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  kicker: string;
  title: string;
}) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <p className="section-kicker">{kicker}</p>
          <h2 className={styles.panelTitle}>{title}</h2>
        </div>
        {icon}
      </div>
      <div className={styles.panelBody}>{children}</div>
    </article>
  );
}

function KpiCard({
  icon,
  label,
  note,
  value
}: {
  icon: React.ReactNode;
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

function FunnelStep({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className={styles.funnelStep}>
      <div className={styles.kpiIcon}>{icon}</div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function MetricTiles({ items }: { items: Array<{ label: string; value: number | string }> }) {
  return (
    <div className={styles.metricTiles}>
      {items.map((item) => (
        <div className={styles.metricTile} key={item.label}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function BucketList({ items, title }: { items: CountByBucket[]; title: string }) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <section className={styles.bucketPanel}>
      <p className="section-kicker">{title}</p>
      <div className={styles.bucketList}>
        {items.slice(0, 6).map((item) => (
          <div className={styles.bucketRow} key={item.bucket}>
            <span>{formatBucket(item.bucket)}</span>
            <strong>{item.count}</strong>
            <div className={styles.bucketTrack}>
              <span style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatPercent(value: number) {
  const percent = Math.abs(value) <= 1 ? value * 100 : value;

  return `${Math.round(percent)}%`;
}

function formatBucket(value: string) {
  return value.replaceAll("-", " ").replaceAll("_", " ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}
