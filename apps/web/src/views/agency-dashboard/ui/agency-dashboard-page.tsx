import { Activity, Bot, Clock, Search, ShieldCheck, Users } from "lucide-react";
import type { CountByBucket, TenantDashboardMetrics } from "@propertyflow/contracts";
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

        <section className={styles.kpiGrid} aria-label="Tenant KPIs">
          <KpiCard
            label="Available listings"
            note={`${metrics.totalProperties} total inventory`}
            value={metrics.availableProperties}
          />
          <KpiCard
            label="Open leads"
            note={`${metrics.unassignedLeads} unassigned`}
            value={metrics.totalLeads}
          />
          <KpiCard
            label="Conversion"
            note={`${metrics.wonLeads} won / ${metrics.lostLeads} lost`}
            value={formatPercent(metrics.conversionRate)}
          />
          <KpiCard
            label="Search to lead"
            note={`${metrics.attributedLeads} attributed leads`}
            value={formatPercent(metrics.searchToLeadConversionRate)}
          />
        </section>

        <section className={styles.mainGrid}>
          <Panel
            icon={<Bot size={20} />}
            kicker="AI Concierge"
            title="Consultations that turn into CRM work"
          >
            <div className={styles.healthGrid}>
              <HealthTile label="Sessions" value={metrics.conciergeSessions} />
              <HealthTile
                label="Recommended"
                value={metrics.conciergeRecommendedSessions}
              />
              <HealthTile
                label="Lead conversion"
                value={formatPercent(metrics.conciergeLeadConversionRate)}
              />
            </div>
            <BucketList
              items={metrics.conciergeRecommendationsByArea}
              title="Top recommended areas"
            />
          </Panel>

          <Panel
            icon={<Clock size={20} />}
            kicker="Lead SLA"
            title="Response health"
          >
            <div className={styles.healthGrid}>
              <HealthTile
                label="Health"
                value={`${metrics.leadSlaHealthScore}/100`}
              />
              <HealthTile
                label="Breached"
                value={metrics.leadSlaResponseBreached}
              />
              <HealthTile
                label="Due soon"
                value={metrics.leadSlaResponseDueSoon}
              />
            </div>
            <BucketList
              items={metrics.leadSlaBreachedBySource}
              title="Breaches by source"
            />
          </Panel>
        </section>

        <section className={styles.splitGrid}>
          <Panel
            icon={<Search size={20} />}
            kicker="Saved search"
            title="Follow-up opportunities"
          >
            <div className={styles.healthGrid}>
              <HealthTile label="Alerts" value={metrics.savedSearches} />
              <HealthTile
                label="Open gaps"
                value={metrics.savedSearchOpenOpportunities}
              />
              <HealthTile
                label="Coverage"
                value={formatPercent(metrics.savedSearchLeadCoverageRate)}
              />
            </div>
            <BucketList items={metrics.topSearchQueries} title="Top searches" />
          </Panel>

          <Panel icon={<Users size={20} />} kicker="CRM" title="Lead mix">
            <BucketList items={metrics.leadsBySource} title="Leads by source" />
            <BucketList items={metrics.leadsByStatus} title="Leads by status" />
          </Panel>
        </section>

        <section className={styles.splitGrid}>
          <Panel
            icon={<Activity size={20} />}
            kicker="Data quality"
            title="Queue hygiene"
          >
            <div className={styles.healthGrid}>
              <HealthTile
                label="Health"
                value={`${metrics.leadQualityHealthScore}/100`}
              />
              <HealthTile
                label="Issues"
                value={metrics.leadQualityIssueCount}
              />
              <HealthTile
                label="Affected"
                value={metrics.leadQualityAffectedLeads}
              />
            </div>
            <BucketList items={metrics.leadQualityByIssue} title="Issue mix" />
          </Panel>

          <Panel
            icon={<ShieldCheck size={20} />}
            kicker="Guardrails"
            title="AI action safety"
          >
            <div className={styles.healthGrid}>
              <HealthTile
                label="Blocked AI"
                value={metrics.security.blockedAiActions}
              />
              <HealthTile
                label="Delete previews"
                value={metrics.security.imageDeletePreviews}
              />
              <HealthTile
                label="Rejected jobs"
                value={metrics.security.rejectedJobEnqueues}
              />
            </div>
            <BucketList
              items={metrics.security.blockedAiActionsByName}
              title="Blocked actions"
            />
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
  title,
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
      <div className={styles.metricList}>{children}</div>
    </article>
  );
}

function KpiCard({
  label,
  note,
  value,
}: {
  label: string;
  note: string;
  value: number | string;
}) {
  return (
    <article className={styles.kpiCard}>
      <span className={styles.kpiLabel}>{label}</span>
      <strong className={styles.kpiValue}>{value}</strong>
      <span className={styles.kpiNote}>{note}</span>
    </article>
  );
}

function HealthTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.healthTile}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function BucketList({ items, title }: { items: CountByBucket[]; title: string }) {
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className={styles.metricList}>
      <p className="section-kicker">{title}</p>
      {items.slice(0, 5).map((item) => (
        <div className={styles.metricRow} key={item.bucket}>
          <div className={styles.metricRowTop}>
            <span>{formatBucket(item.bucket)}</span>
            <strong>{item.count}</strong>
          </div>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{ width: `${Math.max(8, (item.count / maxCount) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatBucket(value: string) {
  return value.replaceAll("-", " ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}
