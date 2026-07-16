import type { PropertySocialPostDraft } from "@propertyflow/contracts";
import { SocialPostDraftCard } from "./social-post-draft-card";
import styles from "./listing-social-posts-panel.module.css";

export function ListingSocialPostsPanel({ drafts }: { drafts: PropertySocialPostDraft[] }) {
  return (
    <section className={styles.panel} aria-label="Social post drafts">
      <div className={styles.header}>
        <div>
          <p className="section-kicker">Growth automation</p>
          <h2 className={styles.title}>Social post drafts</h2>
        </div>
        <span className={styles.counter}>{drafts.length} channels</span>
      </div>
      <div className={styles.grid}>
        {drafts.map((draft) => (
          <SocialPostDraftCard draft={draft} key={draft.channel} />
        ))}
      </div>
    </section>
  );
}
