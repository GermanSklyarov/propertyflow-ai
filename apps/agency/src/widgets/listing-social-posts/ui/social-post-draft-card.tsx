"use client";

import { CheckCircle2, Clipboard, Hash, Megaphone, MessageCircle, Pencil, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { composeSocialPostText } from "@entities/listing/lib/social-post-copy";
import type { PropertySocialPostDraft } from "@propertyflow/contracts";
import styles from "./listing-social-posts-panel.module.css";

export function SocialPostDraftCard({ draft }: { draft: PropertySocialPostDraft }) {
  const [body, setBody] = useState(draft.body);
  const [cta, setCta] = useState(draft.cta);
  const [hashtags, setHashtags] = useState(draft.hashtags.join(" "));
  const [hook, setHook] = useState(draft.hook);
  const [copied, setCopied] = useState(false);
  const tagItems = useMemo(() => hashtags.split(/\s+/).map((tag) => tag.trim()).filter(Boolean), [hashtags]);
  const copyText = composeSocialPostText({
    body,
    cta,
    hashtags: tagItems,
    hook
  });

  async function copyDraft() {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.icon}>
          {draft.channel === "line-voom" ? <MessageCircle size={18} /> : draft.channel === "facebook" ? <Megaphone size={18} /> : <Sparkles size={18} />}
        </span>
        <div>
          <strong>{draft.label}</strong>
          <small className={draft.status === "ready" ? styles.ready : styles.review}>{draft.status === "ready" ? "Ready draft" : "Needs review"}</small>
        </div>
      </div>
      <p className={styles.hook}>{hook}</p>
      <p className={styles.body}>{body}</p>
      <p className={styles.cta}>{cta}</p>
      <div className={styles.tags} aria-label={`${draft.label} hashtags`}>
        <Hash size={15} />
        {tagItems.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className={styles.cardActions}>
        <details className={styles.editDetails}>
          <summary className={`${styles.actionButton} ${styles.secondaryAction}`}>
            <Pencil size={14} />
            <span>Edit</span>
          </summary>
          <div className={styles.editForm}>
            <label>
              <span>Hook</span>
              <input value={hook} onChange={(event) => setHook(event.target.value)} />
            </label>
            <label>
              <span>Body</span>
              <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} />
            </label>
            <label>
              <span>CTA</span>
              <input value={cta} onChange={(event) => setCta(event.target.value)} />
            </label>
            <label>
              <span>Hashtags</span>
              <input value={hashtags} onChange={(event) => setHashtags(event.target.value)} />
            </label>
          </div>
        </details>
        <button className={`${styles.actionButton} ${styles.primaryAction}`} type="button" onClick={copyDraft}>
          {copied ? <CheckCircle2 size={14} /> : <Clipboard size={14} />}
          <span>{copied ? "Copied" : "Copy post"}</span>
        </button>
      </div>
    </article>
  );
}
