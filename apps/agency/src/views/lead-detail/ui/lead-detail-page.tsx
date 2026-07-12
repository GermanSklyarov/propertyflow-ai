import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react";
import type { LeadNotesResponse, LeadSnapshot, LeadTimelineResponse } from "@propertyflow/contracts";
import { formatBucket, formatDateTime } from "@shared/lib/formatters";
import styles from "./lead-detail-page.module.css";

export function LeadDetailPage({
  lead,
  notes,
  timeline
}: {
  lead: LeadSnapshot;
  notes: LeadNotesResponse;
  timeline: LeadTimelineResponse;
}) {
  const followUpState = getFollowUpState(lead);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/leads">
              <ArrowLeft size={16} />
              Back to leads
            </Link>
            <p className="section-kicker">Lead workspace</p>
            <h1 className={styles.title}>{lead.contactName}</h1>
            <p className={styles.subtitle}>{lead.message ?? "No message yet. Review context and assign next action."}</p>
          </div>
          <span className={styles.statusBadge}>{formatBucket(lead.status)}</span>
        </header>

        <section className={styles.kpiGrid} aria-label="Lead detail overview">
          <KpiCard icon={<Sparkles size={18} />} label="Source" note="Acquisition channel" value={formatBucket(lead.source)} />
          <KpiCard icon={<ShieldCheck size={18} />} label="Priority" note="Queue signal" value={lead.priority ?? "none"} />
          <KpiCard icon={<UserRound size={18} />} label="Owner" note="Assigned agent" value={lead.assignedAgentId ? shortAgentName(lead.assignedAgentId) : "Unassigned"} />
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

        <section className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className="section-kicker">Timeline</p>
                <h2 className={styles.panelTitle}>Activity history</h2>
              </div>
              <CalendarClock size={20} />
            </div>
            <div className={styles.timelineList}>
              {timeline.items.map((event) => (
                <article className={styles.timelineItem} key={event.id}>
                  <span>{formatBucket(event.type)}</span>
                  <strong>{event.title}</strong>
                  <small>{formatDateTime(event.createdAt)}</small>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className="section-kicker">Notes</p>
                <h2 className={styles.panelTitle}>Agent context</h2>
              </div>
              <MessageSquareText size={20} />
            </div>
            <div className={styles.noteList}>
              {notes.items.length ? (
                notes.items.map((note) => (
                  <article className={styles.noteItem} key={note.id}>
                    <p>{note.note}</p>
                    <small>
                      {note.createdByUserRole ?? "agent"} · {formatDateTime(note.createdAt)}
                    </small>
                  </article>
                ))
              ) : (
                <article className={styles.noteItem}>
                  <p>No notes yet. Add first outreach summary after contacting the lead.</p>
                  <small>empty state</small>
                </article>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
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

function getFollowUpState(lead: LeadSnapshot) {
  if (!lead.nextFollowUpAt) {
    return { note: "Needs scheduling", value: "No follow-up" };
  }

  const followUpAt = new Date(lead.nextFollowUpAt);

  if (followUpAt < new Date()) {
    return { note: "Past due", value: `Overdue ${formatDateTime(lead.nextFollowUpAt)}` };
  }

  return { note: "Next action", value: formatDateTime(lead.nextFollowUpAt) };
}

function shortAgentName(agentId: string) {
  return agentId.replace("agent-", "Agent ").replace("demo-", "");
}
