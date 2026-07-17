"use client";

import { CheckCircle2, Clipboard, Hash, Link2, Megaphone, MessageCircle, Pencil, Sparkles, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { composeSocialPostText } from "@entities/listing/lib/social-post-copy";
import type { PropertySocialPostDraft } from "@propertyflow/contracts";
import styles from "./listing-social-posts-panel.module.css";

export function SocialPostDraftCard({ draft }: { draft: PropertySocialPostDraft }) {
  const [body, setBody] = useState(draft.body);
  const [cta, setCta] = useState(draft.cta);
  const [hashtags, setHashtags] = useState(draft.hashtags.join(" "));
  const [hook, setHook] = useState(draft.hook);
  const [copied, setCopied] = useState(false);
  const initialHashtags = draft.hashtags.join(" ");
  const tagItems = useMemo(() => hashtags.split(/\s+/).map((tag) => tag.trim()).filter(Boolean), [hashtags]);
  const copyText = composeSocialPostText({
    body,
    cta,
    hashtags: tagItems,
    hook
  });

  useEffect(() => {
    setBody(draft.body);
    setCta(draft.cta);
    setHashtags(initialHashtags);
    setHook(draft.hook);
    setCopied(false);
  }, [draft.body, draft.cta, draft.hook, initialHashtags]);

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
      <div className={styles.readiness} aria-label={`${draft.label} readiness`}>
        {draft.readiness.map((check) => (
          <span className={check.ready ? styles.readinessReady : styles.readinessReview} key={check.key}>
            <CheckCircle2 size={13} />
            {check.label}
          </span>
        ))}
      </div>
      <details className={styles.publicationPlan}>
        <summary>
          <Link2 size={15} />
          <strong>Tracking kit</strong>
          <span title={draft.publicationPlan.trackingSlug}>{shortenIdentifier(draft.publicationPlan.trackingSlug)}</span>
        </summary>
        <p>{draft.publicationPlan.nextAction}</p>
        <dl>
          <div>
            <dt>Source</dt>
            <dd>{draft.publicationPlan.utm.source}</dd>
          </div>
          <div>
            <dt>Campaign</dt>
            <dd>{draft.publicationPlan.utm.campaign}</dd>
          </div>
          <div>
            <dt>Content</dt>
            <dd>{draft.publicationPlan.utm.content}</dd>
          </div>
        </dl>
      </details>
      <div className={styles.workflowPlan}>
        <div className={styles.workflowHeader}>
          <Workflow size={15} />
          <strong>Approval flow</strong>
        </div>
        <ol>
          {draft.approvalWorkflow.stages.map((stage) => (
            <li className={styles[`workflow${capitalizeWorkflowState(stage.state)}`]} key={stage.key}>
              {formatWorkflowStage(stage.label)}
            </li>
          ))}
        </ol>
        <p>{draft.approvalWorkflow.reviewNote}</p>
        {draft.approvalWorkflow.allowedActions.length ? (
          <div className={styles.workflowActions}>
            {draft.approvalWorkflow.allowedActions.map((action) => (
              <span key={action}>{formatWorkflowAction(action)}</span>
            ))}
          </div>
        ) : null}
      </div>
      <details className={styles.mediaPlan}>
        <summary>{draft.mediaPlan.summary}</summary>
        {draft.mediaPlan.items.length ? (
          <div className={styles.mediaStrip} aria-label={`${draft.label} recommended photos`}>
            {draft.mediaPlan.items.slice(0, 5).map((item) => (
              <figure key={item.imageId}>
                <img src={item.imageUrl} alt={item.caption ?? `${draft.label} ${item.role} photo`} />
                <figcaption>{item.role}</figcaption>
              </figure>
            ))}
          </div>
        ) : null}
        {draft.mediaPlan.warnings.length ? (
          <ul>
            {draft.mediaPlan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </details>
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

function capitalizeWorkflowState(value: PropertySocialPostDraft["approvalWorkflow"]["stages"][number]["state"]) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function formatWorkflowAction(action: PropertySocialPostDraft["approvalWorkflow"]["allowedActions"][number]) {
  return action
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatWorkflowStage(label: string) {
  return label === "Approved" ? "Approve" : label === "Published" ? "Publish" : label;
}

function shortenIdentifier(value: string) {
  return value.length > 38 ? `${value.slice(0, 18)}...${value.slice(-14)}` : value;
}
