import { BadgeCheck, DraftingCompass } from "lucide-react";
import type { buildListingNextActions, buildListingReadiness } from "@entities/listing/lib/listing-readiness";
import styles from "./listing-agent-guidance-panel.module.css";

type ListingReadiness = ReturnType<typeof buildListingReadiness>;
type ListingNextActions = ReturnType<typeof buildListingNextActions>;

export function ListingAgentGuidancePanel({
  nextActions,
  readiness
}: {
  nextActions: ListingNextActions;
  readiness: ListingReadiness;
}) {
  return (
    <section className={styles.layout}>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className="section-kicker">AI readiness</p>
            <h2 className={styles.panelTitle}>Publication signals</h2>
          </div>
          <BadgeCheck size={20} />
        </div>
        <div className={styles.readinessList}>
          {readiness.checks.map((check) => (
            <article className={`${styles.readinessItem} ${check.done ? styles.done : styles.missing}`} key={check.label}>
              <span>{check.done ? "Ready" : "Missing"}</span>
              <strong>{check.label}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className="section-kicker">Agent actions</p>
            <h2 className={styles.panelTitle}>Next best steps</h2>
          </div>
          <DraftingCompass size={20} />
        </div>
        <div className={styles.actionList}>
          {nextActions.map((action) => (
            <article className={styles.actionItem} key={action.title}>
              <strong>{action.title}</strong>
              <p>{action.body}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
