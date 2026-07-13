import { CalendarClock, MessageSquareText } from "lucide-react";
import type { LeadNotesResponse, LeadTimelineResponse } from "@propertyflow/contracts";
import { formatBucket, formatDateTime } from "@shared/lib/formatters";
import styles from "./lead-activity-panel.module.css";

export function LeadActivityPanel({
  notes,
  timeline
}: {
  notes: LeadNotesResponse;
  timeline: LeadTimelineResponse;
}) {
  return (
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
  );
}
