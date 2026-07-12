import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock3,
  Mail,
  Phone,
  Sparkles,
  UserRound,
  Users
} from "lucide-react";
import type { CountByBucket, LeadQueueSummaryResponse, LeadSnapshot } from "@propertyflow/contracts";
import { formatBucket, formatDateTime } from "@shared/lib/formatters";
import styles from "./leads-page.module.css";

export function LeadsPage({
  leads,
  queueSummary,
  total
}: {
  leads: LeadSnapshot[];
  queueSummary: LeadQueueSummaryResponse;
  total: number;
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
          <span className={styles.updated}>Updated {formatDateTime(queueSummary.generatedAt)}</span>
        </header>

        <section className={styles.kpiGrid} aria-label="Lead queue overview">
          <KpiCard icon={<Users size={18} />} label="Total leads" note={`${queueSummary.open} open`} value={total} />
          <KpiCard
            icon={<UserRound size={18} />}
            label="Unassigned"
            note={`${queueSummary.assigned} already owned`}
            tone={queueSummary.unassigned > 0 ? "warning" : "good"}
            value={queueSummary.unassigned}
          />
          <KpiCard
            icon={<Clock3 size={18} />}
            label="Overdue"
            note={`${queueSummary.dueSoonFollowUps} due soon`}
            tone={queueSummary.overdueFollowUps > 0 ? "danger" : "good"}
            value={queueSummary.overdueFollowUps}
          />
          <KpiCard
            icon={<Sparkles size={18} />}
            label="High priority"
            note="AI and manager signals"
            value={queueSummary.highPriority}
          />
        </section>

        <section className={styles.board}>
          <aside className={styles.sidePanel} aria-label="Lead queue filters">
            <QueueBucketList items={queueSummary.byStatus} title="Status mix" />
            <QueueBucketList items={queueSummary.bySource} title="Source mix" />
            <QueueBucketList items={queueSummary.byPriority} title="Priority mix" />
          </aside>

          <section className={styles.queue} aria-label="Lead queue">
            <div className={styles.queueHeader}>
              <div>
                <p className="section-kicker">Next best work</p>
                <h2 className={styles.queueTitle}>Follow-up queue</h2>
              </div>
              <span className={styles.queueCount}>{leads.length} visible</span>
            </div>

            <div className={styles.leadList}>
              {leads.map((lead) => (
                <LeadRow key={lead.id} lead={lead} />
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function LeadRow({ lead }: { lead: LeadSnapshot }) {
  const followUpState = getFollowUpState(lead);

  return (
    <article className={styles.leadRow}>
      <div className={styles.leadMain}>
        <div className={styles.leadHeading}>
          <span className={`${styles.sourceIcon} ${lead.source === "ai-concierge" ? styles.sourceIconAi : ""}`}>
            {lead.source === "ai-concierge" || lead.source === "ai-chat" ? <Bot size={16} /> : <CircleDot size={16} />}
          </span>
          <div>
            <h3 className={styles.leadName}>{lead.contactName}</h3>
            <p className={styles.leadMeta}>
              {formatBucket(lead.source)} · {formatDateTime(lead.createdAt)}
            </p>
          </div>
        </div>

        <p className={styles.message}>{lead.message ?? "No message yet. Review context and assign next action."}</p>

        <div className={styles.contactRow}>
          {lead.contactEmail ? (
            <span>
              <Mail size={14} />
              {lead.contactEmail}
            </span>
          ) : null}
          {lead.contactPhone ? (
            <span>
              <Phone size={14} />
              {lead.contactPhone}
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.leadSignals}>
        <StatusPill status={lead.status} />
        <PriorityPill priority={lead.priority} />
        <span className={`${styles.followUpPill} ${styles[followUpState.tone]}`}>
          {followUpState.icon}
          {followUpState.label}
        </span>
      </div>

      <div className={styles.ownerCell}>
        <span className="section-kicker">Owner</span>
        <strong>{lead.assignedAgentId ? shortAgentName(lead.assignedAgentId) : "Unassigned"}</strong>
      </div>
    </article>
  );
}

function KpiCard({
  icon,
  label,
  note,
  tone = "default",
  value
}: {
  icon: React.ReactNode;
  label: string;
  note: string;
  tone?: "default" | "danger" | "good" | "warning";
  value: number | string;
}) {
  return (
    <article className={`${styles.kpiCard} ${styles[tone]}`}>
      <div className={styles.kpiIcon}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function QueueBucketList({ items, title }: { items: CountByBucket[]; title: string }) {
  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;

  return (
    <section className={styles.bucketPanel}>
      <p className="section-kicker">{title}</p>
      <div className={styles.bucketList}>
        {items.map((item) => (
          <div className={styles.bucketRow} key={item.bucket}>
            <span>{formatBucket(item.bucket)}</span>
            <strong>{item.count}</strong>
            <div className={styles.bucketTrack}>
              <span style={{ width: `${Math.max(8, (item.count / total) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: LeadSnapshot["status"] }) {
  return <span className={`${styles.statusPill} ${styles[`status-${status}`]}`}>{formatBucket(status)}</span>;
}

function PriorityPill({ priority }: { priority?: LeadSnapshot["priority"] }) {
  return <span className={styles.priorityPill}>{priority ? `${priority} priority` : "no priority"}</span>;
}

function getFollowUpState(lead: LeadSnapshot) {
  if (!lead.nextFollowUpAt) {
    return { icon: <CalendarClock size={14} />, label: "No follow-up", tone: "neutralFollowUp" as const };
  }

  const followUpAt = new Date(lead.nextFollowUpAt);
  const now = new Date();

  if (followUpAt < now) {
    return {
      icon: <AlertTriangle size={14} />,
      label: `Overdue ${formatDateTime(lead.nextFollowUpAt)}`,
      tone: "dangerFollowUp" as const
    };
  }

  return {
    icon: <CheckCircle2 size={14} />,
    label: `Next ${formatDateTime(lead.nextFollowUpAt)}`,
    tone: "goodFollowUp" as const
  };
}

function shortAgentName(agentId: string) {
  return agentId.replace("agent-", "Agent ").replace("demo-", "");
}
