import { BadgeCheck, Building2, CircleDot, Code2, Globe2, KeyRound, Palette, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import type { ReactNode } from "react";
import { UpdateTenantSettingsForm } from "@features/tenant-settings-update/ui/update-tenant-settings-form";
import type { TenantSnapshot, TenantUsageMetric, TenantUsageResponse } from "@propertyflow/contracts";
import { formatDate, formatNumber, formatPercent } from "@shared/lib/formatters";
import styles from "./tenant-settings-panel.module.css";

export function TenantSettingsPanel({
  saved,
  tenant,
  usage
}: {
  saved?: boolean;
  tenant: TenantSnapshot;
  usage: TenantUsageResponse;
}) {
  return (
    <>
      <section className={styles.kpiGrid} aria-label="Tenant settings overview">
        <KpiCard icon={<Building2 size={18} />} label="Plan" note="Subscription tier" value={tenant.subscriptionPlan} />
        <KpiCard icon={<Globe2 size={18} />} label="Domain" note={tenant.customDomain ?? "Not configured"} value={formatDomainStatus(tenant.domainStatus)} />
        <KpiCard icon={<Users size={18} />} label="Agents" note="Seats used" value={formatUsage(getUsage(usage.items, "agents"))} />
        <KpiCard icon={<Code2 size={18} />} label="Public API" note="Requests this month" value={formatUsage(getUsage(usage.items, "publicApiRequestsMonthly"))} />
      </section>

      <section className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Tenant profile</p>
              <h2 className={styles.panelTitle}>Workspace identity</h2>
            </div>
            <SlidersHorizontal size={20} />
          </div>
          <div className={styles.fieldGrid}>
            <Field label="Tenant ID" value={tenant.id} />
            <Field label="Slug" value={tenant.slug} />
            <Field label="Primary market" value={tenant.primaryMarket ?? "not set"} />
            <Field label="Created" value={formatDate(tenant.createdAt)} />
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Branding</p>
              <h2 className={styles.panelTitle}>Agency presence</h2>
            </div>
            <Palette size={20} />
          </div>
          <div className={styles.brandRow}>
            <span
              aria-label="Primary brand color"
              className={styles.swatch}
              style={{ background: tenant.branding.primaryColor ?? "#0f766e" }}
            />
            <div>
              <strong>{tenant.branding.displayName}</strong>
              <span>{tenant.branding.primaryColor ?? "default teal"}</span>
            </div>
          </div>
          <div className={styles.fieldGrid}>
            <Field label="Custom domain" value={tenant.customDomain ?? "not configured"} />
            <Field label="Domain status" value={formatDomainStatus(tenant.domainStatus)} />
            <Field label="Logo URL" value={tenant.branding.logoUrl ?? "not configured"} />
          </div>
        </section>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className="section-kicker">Editable setup</p>
            <h2 className={styles.panelTitle}>Update workspace settings</h2>
          </div>
          <SlidersHorizontal size={20} />
        </div>

        <UpdateTenantSettingsForm saved={saved} tenant={tenant} />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className="section-kicker">Limits</p>
            <h2 className={styles.panelTitle}>Usage this billing period</h2>
          </div>
          <span className={styles.statusBadge}>Updated {formatDate(usage.generatedAt)}</span>
        </div>
        <div className={styles.usageGrid}>
          {usage.items.map((item) => (
            <UsageCard item={item} key={item.key} />
          ))}
        </div>
      </section>

      <section className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Access model</p>
              <h2 className={styles.panelTitle}>Role matrix</h2>
            </div>
            <ShieldCheck size={20} />
          </div>
          <div className={styles.roleList}>
            <RoleRow label="Agent" scope="Own leads, assigned listings, Concierge follow-up" />
            <RoleRow label="Broker" scope="Team inventory, lead assignment, publishing controls" />
            <RoleRow label="Manager" scope="Settings, analytics, AI tools, integrations" />
            <RoleRow label="Admin" scope="Tenant administration and platform-level controls" />
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Integrations</p>
              <h2 className={styles.panelTitle}>API readiness</h2>
            </div>
            <KeyRound size={20} />
          </div>
          <div className={styles.integrationList}>
            <IntegrationRow label="Public property API" status="ready" />
            <IntegrationRow label="Public lead capture API" status="ready" />
            <IntegrationRow label="S3/MinIO media storage" status="configured" />
            <IntegrationRow label="OpenSearch indexing" status="configured" />
            <IntegrationRow label="WebSocket realtime" status="enabled" />
          </div>
        </section>
      </section>
    </>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function UsageCard({ item }: { item: TenantUsageMetric }) {
  return (
    <article className={styles.usageCard}>
      <div className={styles.usageTop}>
        <span>{formatUsageKey(item.key)}</span>
        <strong>{formatPercent(item.utilizationRate)}</strong>
      </div>
      <div className={styles.usageTrack}>
        <span style={{ width: `${Math.min(100, item.utilizationRate)}%` }} />
      </div>
      <small>
        {formatNumber(item.used)} used / {formatNumber(item.limit)} limit
      </small>
    </article>
  );
}

function RoleRow({ label, scope }: { label: string; scope: string }) {
  return (
    <div className={styles.roleRow}>
      <BadgeCheck size={16} />
      <strong>{label}</strong>
      <span>{scope}</span>
    </div>
  );
}

function IntegrationRow({ label, status }: { label: string; status: string }) {
  return (
    <div className={styles.integrationRow}>
      <CircleDot size={16} />
      <strong>{label}</strong>
      <span>{status}</span>
    </div>
  );
}

function getUsage(items: TenantUsageMetric[], key: TenantUsageMetric["key"]) {
  return items.find((item) => item.key === key);
}

function formatUsage(item?: TenantUsageMetric) {
  return item ? `${formatNumber(item.used)}/${formatNumber(item.limit)}` : "n/a";
}

function formatUsageKey(value: TenantUsageMetric["key"]) {
  const labels = {
    agents: "Agent seats",
    aiCreditsMonthly: "AI credits",
    properties: "Properties",
    publicApiRequestsMonthly: "Public API"
  } satisfies Record<TenantUsageMetric["key"], string>;

  return labels[value];
}

function formatDomainStatus(value: TenantSnapshot["domainStatus"]) {
  return value ? value.replaceAll("-", " ") : "not configured";
}
