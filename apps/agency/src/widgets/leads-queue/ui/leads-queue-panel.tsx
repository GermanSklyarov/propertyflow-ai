import Link from "next/link";
import { Bot, ChevronLeft, ChevronRight, CircleDot, Clock3, Mail, Phone, SlidersHorizontal, Sparkles, UserRound, Users } from "lucide-react";
import { buildLeadFollowUpState, formatLeadOwner } from "@entities/lead/lib/lead-queue";
import {
  buildLeadQueueHref,
  formatLeadSort,
  getLeadQueuePage,
  leadPriorityFilterOptions,
  leadQueuePageSize,
  leadSortFilterOptions,
  leadSourceFilterOptions,
  leadStatusFilterOptions
} from "@entities/lead/model/lead-filters";
import type { CountByBucket, LeadQueueSummaryResponse, LeadSnapshot, ListLeadsRequest } from "@propertyflow/contracts";
import { formatBucket, formatDateTime } from "@shared/lib/formatters";
import styles from "./leads-queue-panel.module.css";

export function LeadsQueuePanel({
  filters,
  leads,
  queueSummary,
  total
}: {
  filters: ListLeadsRequest;
  leads: LeadSnapshot[];
  queueSummary: LeadQueueSummaryResponse;
  total: number;
}) {
  const currentPage = getLeadQueuePage(filters);
  const pageCount = Math.max(1, Math.ceil(total / (filters.limit ?? leadQueuePageSize)));
  const firstVisible = total === 0 ? 0 : (filters.offset ?? 0) + 1;
  const lastVisible = Math.min(total, (filters.offset ?? 0) + leads.length);

  return (
    <>
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
        <KpiCard icon={<Sparkles size={18} />} label="High priority" note="AI and manager signals" value={queueSummary.highPriority} />
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

          <div className={styles.quickFilters} aria-label="Quick lead filters">
            <Link className={isEmptyLeadFilter(filters) ? styles.quickFilterActive : ""} href="/leads">
              All
            </Link>
            <Link
              className={filters.unassigned ? styles.quickFilterActive : ""}
              href={buildLeadQueueHref(filters, { priority: undefined, status: undefined, unassigned: true })}
            >
              Unassigned
            </Link>
            <Link
              className={filters.priority === "high" ? styles.quickFilterActive : ""}
              href={buildLeadQueueHref(filters, { priority: "high", status: undefined, unassigned: undefined })}
            >
              High priority
            </Link>
            <Link
              className={filters.status === "new" ? styles.quickFilterActive : ""}
              href={buildLeadQueueHref(filters, { priority: undefined, status: "new", unassigned: undefined })}
            >
              New leads
            </Link>
          </div>

          <form action="/leads" className={styles.toolbar} method="get">
            <label>
              <SlidersHorizontal size={16} />
              <select defaultValue={filters.status ?? ""} name="status">
                <option value="">Any status</option>
                {leadStatusFilterOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatBucket(status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <select defaultValue={filters.source ?? ""} name="source">
                <option value="">Any source</option>
                {leadSourceFilterOptions.map((source) => (
                  <option key={source} value={source}>
                    {formatBucket(source)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <select defaultValue={filters.priority ?? ""} name="priority">
                <option value="">Any priority</option>
                {leadPriorityFilterOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    {formatBucket(priority)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <select defaultValue={filters.unassigned ? "true" : ""} name="unassigned">
                <option value="">Any owner</option>
                <option value="true">Unassigned only</option>
              </select>
            </label>
            <label>
              <select defaultValue={filters.sort ?? "follow-up-asc"} name="sort">
                {leadSortFilterOptions.map((sort) => (
                  <option key={sort} value={sort}>
                    {formatLeadSort(sort)}
                  </option>
                ))}
              </select>
            </label>
            {filters.propertyId ? <input name="propertyId" type="hidden" value={filters.propertyId} /> : null}
            {filters.attributionSocialPostTrackingSlug ? (
              <input name="attributionSocialPostTrackingSlug" type="hidden" value={filters.attributionSocialPostTrackingSlug} />
            ) : null}
            <span className={styles.resultMeta}>
              {firstVisible}-{lastVisible} of {total}
            </span>
            <button type="submit">Apply filters</button>
          </form>

          <div className={styles.leadList}>
            {leads.map((lead) => (
              <LeadRow key={lead.id} lead={lead} />
            ))}
            {leads.length === 0 ? <div className={styles.emptyState}>No leads match this queue filter.</div> : null}
          </div>

          {pageCount > 1 ? (
            <div className={styles.pagination} aria-label="Lead queue pagination">
              <Link
                aria-disabled={currentPage === 1}
                className={currentPage === 1 ? styles.paginationDisabled : ""}
                href={buildLeadQueueHref(filters, { page: Math.max(1, currentPage - 1) })}
              >
                <ChevronLeft size={16} />
                Prev
              </Link>
              <span>
                Page {currentPage} of {pageCount} · {formatLeadSort(filters.sort ?? "follow-up-asc")}
              </span>
              <Link
                aria-disabled={currentPage === pageCount}
                className={currentPage === pageCount ? styles.paginationDisabled : ""}
                href={buildLeadQueueHref(filters, { page: Math.min(pageCount, currentPage + 1) })}
              >
                Next
                <ChevronRight size={16} />
              </Link>
            </div>
          ) : null}
        </section>
      </section>
    </>
  );
}

function isEmptyLeadFilter(filters: ListLeadsRequest) {
  return !filters.status && !filters.source && !filters.priority && !filters.unassigned && !filters.propertyId && !filters.attributionSocialPostTrackingSlug;
}

function LeadRow({ lead }: { lead: LeadSnapshot }) {
  const followUpState = buildLeadFollowUpState(lead);

  return (
    <Link className={styles.leadRow} href={`/leads/${lead.id}`}>
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
        <strong>{formatLeadOwner(lead.assignedAgentId)}</strong>
      </div>
    </Link>
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
