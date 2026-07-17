"use client";

import { CheckCircle2, Clipboard, Eye, Hash, Megaphone, MessageCircle, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { composeSocialPostText } from "@entities/listing/lib/social-post-copy";
import type { PropertySocialPostDraft, PropertySocialPostPublication, PropertySocialPostReview } from "@propertyflow/contracts";
import { recordPropertySocialPostPublication, recordPropertySocialPostReview, savePropertySocialPostDraft } from "@shared/api/agency-client";
import {
  formatPublicationStatus,
  formatShortDate,
  formatWorkflowStage,
  getCurrentWorkflowLabel,
  getInitialPublicationStatus,
  getInitialWorkflowStage,
  getWorkflowStages,
  type SocialPostPublicationStatus,
  type SocialPostWorkflowStageKey
} from "../model/social-post-draft-card";
import styles from "./listing-social-posts-panel.module.css";
import { SocialPostDraftReviewModal } from "./social-post-draft-review-modal";

export function SocialPostDraftCard({
  draft,
  propertyId,
  publication,
  review
}: {
  draft: PropertySocialPostDraft;
  propertyId: string;
  publication?: PropertySocialPostPublication;
  review?: PropertySocialPostReview;
}) {
  const router = useRouter();
  const initialPublicationStatus = getInitialPublicationStatus(publication);
  const [body, setBody] = useState(draft.body);
  const [cta, setCta] = useState(draft.cta);
  const [hashtags, setHashtags] = useState(draft.hashtags.join(" "));
  const [hook, setHook] = useState(draft.hook);
  const [publishedUrl, setPublishedUrl] = useState(publication?.publishedUrl ?? "");
  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [publicationStatus, setPublicationStatus] = useState<SocialPostPublicationStatus>(initialPublicationStatus);
  const [reviewActionStatus, setReviewActionStatus] = useState<"idle" | "saving" | "error">("idle");
  const [saveDraftStatus, setSaveDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [workflowStage, setWorkflowStage] = useState<SocialPostWorkflowStageKey>(getInitialWorkflowStage(draft, publication, review));
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
    setPublishedUrl(publication?.publishedUrl ?? "");
    setCopied(false);
    setDetailsOpen(false);
    setPublicationStatus(initialPublicationStatus);
    setReviewActionStatus("idle");
    setSaveDraftStatus("idle");
    setWorkflowStage(getInitialWorkflowStage(draft, publication, review));
  }, [draft.approvalWorkflow.currentStage, draft.body, draft.channel, draft.cta, draft.hook, draft.locale, initialHashtags, initialPublicationStatus, publication, review]);

  async function copyDraft() {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function markPublished(nextPublishedUrl: string) {
    if (!canPublish) {
      return;
    }

    setPublicationStatus("saving");

    try {
      await recordPropertySocialPostPublication(propertyId, {
        channel: draft.channel,
        locale: draft.locale,
        publishedUrl: nextPublishedUrl.trim() || undefined,
        trackingSlug: draft.publicationPlan.trackingSlug,
        utm: draft.publicationPlan.utm
      });
      setPublicationStatus("published");
      router.refresh();
    } catch {
      setPublicationStatus("error");
    }
  }

  async function recordReviewStatus(nextStage: Extract<SocialPostWorkflowStageKey, "review" | "approved">) {
    if (isPublished) {
      return;
    }

    setReviewActionStatus("saving");

    try {
      await recordPropertySocialPostReview(propertyId, {
        channel: draft.channel,
        locale: draft.locale,
        status: nextStage === "approved" ? "approved" : "review_requested",
        trackingSlug: draft.publicationPlan.trackingSlug
      });
      setWorkflowStage(nextStage);
      setReviewActionStatus("idle");
      router.refresh();
    } catch {
      setReviewActionStatus("error");
    }
  }

  async function saveDraftOverride() {
    setSaveDraftStatus("saving");

    try {
      await savePropertySocialPostDraft(propertyId, {
        body,
        channel: draft.channel,
        cta,
        hashtags: tagItems,
        hook,
        locale: draft.locale,
        trackingSlug: draft.publicationPlan.trackingSlug
      });
      setSaveDraftStatus("saved");
      router.refresh();
      window.setTimeout(() => setSaveDraftStatus("idle"), 1600);
    } catch {
      setSaveDraftStatus("error");
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
          onClick={() => setDetailsOpen(true)}
        >
          {publicationStatus === "published" ? <CheckCircle2 size={14} /> : <Send size={14} />}
          <span>{formatPublicationStatus(publicationStatus)}</span>
        </button>
      </div>
      {detailsOpen ? (
        <SocialPostDraftReviewModal
          body={body}
          canApprove={canApprove}
          canPublish={canPublish}
          canRequestReview={canRequestReview}
          cta={cta}
          draft={draft}
          hashtags={hashtags}
          hook={hook}
          publication={publication}
          publicationStatus={publicationStatus}
          publishedUrl={publishedUrl}
          reviewActionStatus={reviewActionStatus}
          saveDraftStatus={saveDraftStatus}
          setBody={setBody}
          setCta={setCta}
          setHashtags={setHashtags}
          setHook={setHook}
          setPublishedUrl={setPublishedUrl}
          workflowStage={workflowStage}
          workflowStages={workflowStages}
          onApprove={() => recordReviewStatus("approved")}
          onClose={() => setDetailsOpen(false)}
          onMarkPublished={() => markPublished(publishedUrl)}
          onRequestReview={() => recordReviewStatus("review")}
          onSaveDraft={saveDraftOverride}
        />
      ) : null}
    </article>
  );
}
