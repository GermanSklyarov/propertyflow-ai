"use client";

import { CheckCircle2, Clipboard, Eye, Hash, Link2, Megaphone, MessageCircle, Pencil, Send, Sparkles, Workflow, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { composeSocialPostText } from "@entities/listing/lib/social-post-copy";
import type { PropertySocialPostDraft, PropertySocialPostPublication, PropertySocialPostWorkflowStage } from "@propertyflow/contracts";
import { recordPropertySocialPostPublication } from "@shared/api/agency-client";
import styles from "./listing-social-posts-panel.module.css";

type WorkflowStageKey = PropertySocialPostDraft["approvalWorkflow"]["currentStage"];

export function SocialPostDraftCard({
  draft,
  propertyId,
  publication
}: {
  draft: PropertySocialPostDraft;
  propertyId: string;
  publication?: PropertySocialPostPublication;
}) {
  const router = useRouter();
  const initialPublicationStatus = publication ? "published" : "idle";
  const [body, setBody] = useState(draft.body);
  const [cta, setCta] = useState(draft.cta);
  const [hashtags, setHashtags] = useState(draft.hashtags.join(" "));
  const [hook, setHook] = useState(draft.hook);
  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [publicationStatus, setPublicationStatus] = useState<"idle" | "saving" | "published" | "error">(initialPublicationStatus);
  const [workflowStage, setWorkflowStage] = useState<WorkflowStageKey>(draft.approvalWorkflow.currentStage);
  const initialHashtags = draft.hashtags.join(" ");
  const tagItems = useMemo(() => hashtags.split(/\s+/).map((tag) => tag.trim()).filter(Boolean), [hashtags]);
  const workflowStages = useMemo(
    () => getWorkflowStages(draft.approvalWorkflow.stages, publicationStatus === "published" ? "published" : workflowStage),
    [draft.approvalWorkflow.stages, publicationStatus, workflowStage]
  );
  const isPublished = publicationStatus === "published";
  const canRequestReview = workflowStage === "draft" && !isPublished;
  const canApprove = (workflowStage === "draft" || workflowStage === "review") && !isPublished;
  const canPublish = workflowStage === "approved" && !isPublished;
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
    setDetailsOpen(false);
    setPublicationStatus(initialPublicationStatus);
    setWorkflowStage(publication ? "published" : draft.approvalWorkflow.currentStage);
  }, [draft.approvalWorkflow.currentStage, draft.body, draft.channel, draft.cta, draft.hook, draft.locale, initialHashtags, initialPublicationStatus, publication]);

  async function copyDraft() {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function markPublished() {
    if (!canPublish) {
      return;
    }

    setPublicationStatus("saving");

    try {
      await recordPropertySocialPostPublication(propertyId, {
        channel: draft.channel,
        locale: draft.locale,
        trackingSlug: draft.publicationPlan.trackingSlug,
        utm: draft.publicationPlan.utm
      });
      setPublicationStatus("published");
      router.refresh();
    } catch {
      setPublicationStatus("error");
    }
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.icon}>
          {draft.channel === "line-voom" ? <MessageCircle size={18} /> : draft.channel === "facebook" ? <Megaphone size={18} /> : <Sparkles size={18} />}
        </span>
        <div>
          <strong>{draft.label}</strong>
          <small className={isPublished ? styles.ready : draft.status === "ready" ? styles.ready : styles.review}>
            {isPublished ? "Published" : draft.status === "ready" ? "Ready draft" : "Needs review"}
          </small>
        </div>
      </div>
      <p className={styles.hook}>{hook}</p>
      <p className={styles.body}>{body}</p>
      <div className={styles.compactMeta}>
        <span className={styles.workflowBadge}>{formatWorkflowStage(getCurrentWorkflowLabel(workflowStages))}</span>
        <span>{draft.mediaPlan.items.length} photos</span>
        <span>{tagItems.length} tags</span>
        {publication ? <span title={publication.publishedAt}>Live {formatShortDate(publication.publishedAt)}</span> : null}
      </div>
      <div className={`${styles.tags} ${styles.compactTags}`} aria-label={`${draft.label} hashtags`}>
        <Hash size={15} />
        {tagItems.slice(0, 3).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
        {tagItems.length > 3 ? <span>+{tagItems.length - 3}</span> : null}
      </div>
      <div className={styles.readiness} aria-label={`${draft.label} readiness`}>
        {draft.readiness.map((check) => (
          <span className={check.ready ? styles.readinessReady : styles.readinessReview} key={check.key}>
            <CheckCircle2 size={13} />
            {check.label}
          </span>
        ))}
      </div>
      <div className={styles.cardActions}>
        <button className={`${styles.actionButton} ${styles.secondaryAction}`} type="button" onClick={() => setDetailsOpen(true)}>
          <Eye size={14} />
          <span>Review details</span>
        </button>
        <button className={`${styles.actionButton} ${styles.primaryAction}`} type="button" onClick={copyDraft}>
          {copied ? <CheckCircle2 size={14} /> : <Clipboard size={14} />}
          <span>{copied ? "Copied" : "Copy post"}</span>
        </button>
        <button
          className={`${styles.actionButton} ${styles.secondaryAction}`}
          disabled={!canPublish || publicationStatus === "saving" || isPublished}
          type="button"
          onClick={markPublished}
        >
          {publicationStatus === "published" ? <CheckCircle2 size={14} /> : <Send size={14} />}
          <span>{formatPublicationStatus(publicationStatus)}</span>
        </button>
      </div>
      {detailsOpen ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setDetailsOpen(false)}>
          <section
            aria-label={`${draft.label} social post review`}
            aria-modal="true"
            className={styles.postModal}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className="section-kicker">
                  {draft.label}
                  {publication ? ` · published ${formatShortDate(publication.publishedAt)}` : ""}
                </p>
                <h3>Review social post</h3>
              </div>
              <button aria-label="Close social post review" type="button" onClick={() => setDetailsOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalGrid}>
              <div className={styles.modalColumn}>
                <p className={styles.hook}>{hook}</p>
                <p className={styles.body}>{body}</p>
                <p className={styles.cta}>{cta}</p>
                <div className={styles.tags} aria-label={`${draft.label} hashtags`}>
                  <Hash size={15} />
                  {tagItems.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <div className={styles.editForm}>
                  <div className={styles.editFormHeader}>
                    <Pencil size={15} />
                    <strong>Edit draft</strong>
                  </div>
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
              </div>
              <div className={styles.modalColumn}>
                <div className={styles.workflowPlan}>
                  <div className={styles.workflowHeader}>
                    <Workflow size={15} />
                    <strong>Approval flow</strong>
                  </div>
                  <ol>
                    {workflowStages.map((stage) => (
                      <li className={styles[`workflow${capitalizeWorkflowState(stage.state)}`]} key={stage.key}>
                        {formatWorkflowStage(stage.label)}
                      </li>
                    ))}
                  </ol>
                  <p>{getWorkflowNote(workflowStage, publicationStatus, draft.approvalWorkflow.reviewNote)}</p>
                  <div className={styles.workflowActions}>
                    <button disabled={!canRequestReview} type="button" onClick={() => setWorkflowStage("review")}>
                      <Send size={13} />
                      <span>Request review</span>
                    </button>
                    <button disabled={!canApprove} type="button" onClick={() => setWorkflowStage("approved")}>
                      <CheckCircle2 size={13} />
                      <span>Approve</span>
                    </button>
                    <div aria-label="Available workflow actions">
                      {draft.approvalWorkflow.allowedActions.map((action) => (
                        <span key={action}>{formatWorkflowAction(action)}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={styles.publicationPlan}>
                  <div className={styles.planHeader}>
                    <Link2 size={15} />
                    <strong>Tracking kit</strong>
                    <span title={draft.publicationPlan.trackingSlug}>{shortenIdentifier(draft.publicationPlan.trackingSlug)}</span>
                  </div>
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
                </div>
                <div className={styles.mediaPlan}>
                  <div className={styles.planHeader}>
                    <Sparkles size={15} />
                    <strong>{draft.mediaPlan.summary}</strong>
                  </div>
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
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </article>
  );
}

function getWorkflowStages(stages: PropertySocialPostWorkflowStage[], currentStage: WorkflowStageKey) {
  const order: WorkflowStageKey[] = ["draft", "review", "approved", "published"];
  const currentIndex = order.indexOf(currentStage);

  return stages.map((stage) => {
    const stageIndex = order.indexOf(stage.key);

    if (stageIndex < currentIndex) {
      return { ...stage, state: "complete" as const };
    }

    if (stageIndex === currentIndex) {
      return { ...stage, state: "current" as const };
    }

    return { ...stage, state: "pending" as const };
  });
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

function getCurrentWorkflowLabel(stages: PropertySocialPostWorkflowStage[]) {
  return stages.find((stage) => stage.state === "current")?.label ?? "Draft";
}

function shortenIdentifier(value: string) {
  return value.length > 38 ? `${value.slice(0, 18)}...${value.slice(-14)}` : value;
}

function formatPublicationStatus(status: "idle" | "saving" | "published" | "error") {
  if (status === "saving") {
    return "Saving";
  }

  if (status === "published") {
    return "Published";
  }

  if (status === "error") {
    return "Retry publish";
  }

  return "Mark published";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getWorkflowNote(
  stage: WorkflowStageKey,
  publicationStatus: "idle" | "saving" | "published" | "error",
  fallback: string
) {
  if (publicationStatus === "published") {
    return "Published and tracked for lead attribution.";
  }

  if (publicationStatus === "saving") {
    return "Saving publication marker...";
  }

  if (publicationStatus === "error") {
    return "Publication marker failed. Check the API and retry.";
  }

  if (stage === "approved") {
    return "Approved for publishing. Mark it as published after the agent posts it.";
  }

  if (stage === "review") {
    return "Queued for manager review before this post goes live.";
  }

  return fallback;
}
