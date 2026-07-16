import { Hash, Megaphone, MessageCircle, Sparkles } from "lucide-react";
import type { PropertySocialPostDraft } from "@propertyflow/contracts";
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
          <article className={styles.card} key={draft.channel}>
            <div className={styles.cardHeader}>
              <span className={styles.icon}>
                {draft.channel === "line-voom" ? <MessageCircle size={18} /> : draft.channel === "facebook" ? <Megaphone size={18} /> : <Sparkles size={18} />}
              </span>
              <div>
                <strong>{draft.label}</strong>
                <small className={draft.status === "ready" ? styles.ready : styles.review}>{draft.status === "ready" ? "Ready draft" : "Needs review"}</small>
              </div>
            </div>
            <p className={styles.hook}>{draft.hook}</p>
            <p className={styles.body}>{draft.body}</p>
            <p className={styles.cta}>{draft.cta}</p>
            <div className={styles.tags} aria-label={`${draft.label} hashtags`}>
              <Hash size={15} />
              {draft.hashtags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
