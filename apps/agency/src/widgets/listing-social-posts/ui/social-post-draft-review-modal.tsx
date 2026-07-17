import { CheckCircle2, Hash, Link2, Pencil, Save, Send, Sparkles, Workflow, X } from "lucide-react";
import type { PropertySocialPostDraft, PropertySocialPostPublication, PropertySocialPostWorkflowStage } from "@propertyflow/contracts";
import {
  capitalizeWorkflowState,
  formatShortDate,
  formatWorkflowAction,
  formatWorkflowStage,
  getWorkflowNote,
  type SocialPostPublicationStatus,
  type SocialPostWorkflowStageKey,
  shortenIdentifier
} from "../model/social-post-draft-card";
import styles from "./listing-social-posts-panel.module.css";

export function SocialPostDraftReviewModal({
  body,
  canApprove,
  canRequestReview,
  cta,
  draft,
  hashtags,
  hook,
  publication,
  publicationStatus,
  reviewActionStatus,
  saveDraftStatus,
  setBody,
  setCta,
  setHashtags,
  setHook,
  workflowStage,
  workflowStages,
  onApprove,
  onClose,
  onRequestReview,
  onSaveDraft
}: {
  body: string;
  canApprove: boolean;
  canRequestReview: boolean;
  cta: string;
  draft: PropertySocialPostDraft;
  hashtags: string;
  hook: string;
  publication?: PropertySocialPostPublication;
  publicationStatus: SocialPostPublicationStatus;
  reviewActionStatus: "idle" | "saving" | "error";
  saveDraftStatus: "idle" | "saving" | "saved" | "error";
  setBody: (value: string) => void;
  setCta: (value: string) => void;
  setHashtags: (value: string) => void;
  setHook: (value: string) => void;
  workflowStage: SocialPostWorkflowStageKey;
  workflowStages: PropertySocialPostWorkflowStage[];
  onApprove: () => void;
  onClose: () => void;
  onRequestReview: () => void;
  onSaveDraft: () => void;
}) {
  const tagItems = hashtags.split(/\s+/).map((tag) => tag.trim()).filter(Boolean);

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}>
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
          <button aria-label="Close social post review" type="button" onClick={onClose}>
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
              <div className={styles.editActions}>
                <button disabled={saveDraftStatus === "saving"} type="button" onClick={onSaveDraft}>
                  {saveDraftStatus === "saved" ? <CheckCircle2 size={14} /> : <Save size={14} />}
                  <span>{getSaveDraftLabel(saveDraftStatus)}</span>
                </button>
                {saveDraftStatus === "error" ? <small>Draft save failed. Check the API and retry.</small> : null}
              </div>
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
              <p>
                {reviewActionStatus === "saving"
                  ? "Saving review workflow status..."
                  : reviewActionStatus === "error"
                    ? "Review workflow update failed. Check the API and retry."
                    : getWorkflowNote(workflowStage, publicationStatus, draft.approvalWorkflow.reviewNote)}
              </p>
              <div className={styles.workflowActions}>
                <button disabled={!canRequestReview || reviewActionStatus === "saving"} type="button" onClick={onRequestReview}>
                  <Send size={13} />
                  <span>Request review</span>
                </button>
                <button disabled={!canApprove || reviewActionStatus === "saving"} type="button" onClick={onApprove}>
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
  );
}

function getSaveDraftLabel(status: "idle" | "saving" | "saved" | "error") {
  if (status === "saving") {
    return "Saving draft";
  }

  if (status === "saved") {
    return "Draft saved";
  }

  if (status === "error") {
    return "Retry save";
  }

  return "Save draft";
}
