import { Clock3, Mail, MapPin, Phone, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { buildLeadFollowUpSummary, formatLeadOwner } from "@entities/lead/lib/lead-queue";
import type { LeadSnapshot } from "@propertyflow/contracts";
import { formatBucket, formatDateTime } from "@shared/lib/formatters";
import styles from "./lead-overview-panel.module.css";

export function LeadOverviewPanel({ lead }: { lead: LeadSnapshot }) {
  const followUpState = buildLeadFollowUpSummary(lead);

  return (
    <>
      <section className={styles.kpiGrid} aria-label="Lead detail overview">
        <KpiCard icon={<Sparkles size={18} />} label="Source" note="Acquisition channel" value={formatBucket(lead.source)} />
        <KpiCard icon={<ShieldCheck size={18} />} label="Priority" note="Queue signal" value={lead.priority ?? "none"} />
        <KpiCard icon={<UserRound size={18} />} label="Owner" note="Assigned agent" value={formatLeadOwner(lead.assignedAgentId)} />
        <KpiCard icon={<Clock3 size={18} />} label="Follow-up" note={followUpState.note} value={followUpState.value} />
      </section>

      <section className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Contact</p>
              <h2 className={styles.panelTitle}>Client details</h2>
            </div>
            <UserRound size={20} />
          </div>
          <div className={styles.fieldGrid}>
            <Field icon={<Mail size={15} />} label="Email" value={lead.contactEmail ?? "not provided"} />
            <Field icon={<Phone size={15} />} label="Phone" value={lead.contactPhone ?? "not provided"} />
            <Field label="Locale" value={lead.preferredLocale ?? "not set"} />
            <Field label="Created" value={formatDateTime(lead.createdAt)} />
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Intent</p>
              <h2 className={styles.panelTitle}>Attribution context</h2>
            </div>
            <MapPin size={20} />
          </div>
          <div className={styles.fieldGrid}>
            <Field label="Property ID" value={lead.propertyId ?? "not linked"} />
            <Field label="Search source" value={lead.attributionSearchSource ?? "not attributed"} />
            <Field label="Search query" value={lead.attributionSearchQuery ?? "not captured"} wide />
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

function Field({
  icon,
  label,
  value,
  wide = false
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`${styles.field} ${wide ? styles.fieldWide : ""}`}>
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
