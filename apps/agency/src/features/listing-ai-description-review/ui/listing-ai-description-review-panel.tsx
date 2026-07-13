import { Check, CheckCircle2, FileText, Sparkles, X } from "lucide-react";
import {
  applyPropertyDescriptionAction,
  reviewPropertyDescriptionAction
} from "@entities/listing/api/listing-actions";
import type { GeneratedPropertyDescription } from "@propertyflow/contracts";
import { formatBucket } from "@shared/lib/formatters";
import styles from "./listing-ai-description-review-panel.module.css";

export function ListingAiDescriptionReviewPanel({
  appliedDescriptionAssetId,
  descriptions,
  propertyId
}: {
  appliedDescriptionAssetId?: string;
  descriptions: GeneratedPropertyDescription[];
  propertyId: string;
}) {
  return (
    <section className={styles.panel} id="ai-descriptions">
      <div className={styles.panelHeader}>
        <div>
          <p className="section-kicker">AI descriptions</p>
          <h2 className={styles.panelTitle}>{buildDescriptionAssetTitle(descriptions)}</h2>
        </div>
        <FileText size={20} />
      </div>
      {descriptions.length ? (
        <div className={styles.descriptionGrid}>
          {descriptions.map((asset) => (
            <article className={styles.descriptionCard} key={asset.id}>
              <div className={styles.descriptionMeta}>
                <span className={`${styles.analysisStatus} ${styles[`analysis-${asset.reviewStatus}`]}`}>
                  {formatBucket(asset.reviewStatus)}
                </span>
                <span>{asset.locale.toUpperCase()}</span>
              </div>
              <h3>{asset.title}</h3>
              <p>{asset.description}</p>
              <div className={styles.analysisActions}>
                <form action={reviewPropertyDescriptionAction.bind(null, propertyId, asset.id, "approved")}>
                  <button className={`${styles.analysisActionButton} ${styles.approveButton}`} type="submit">
                    <Check size={14} />
                    <span>Approve</span>
                  </button>
                </form>
                <form action={reviewPropertyDescriptionAction.bind(null, propertyId, asset.id, "rejected")}>
                  <button className={`${styles.analysisActionButton} ${styles.rejectButton}`} type="submit">
                    <X size={14} />
                    <span>Reject</span>
                  </button>
                </form>
                <form action={applyPropertyDescriptionAction.bind(null, propertyId, asset.id)}>
                  <button
                    className={`${styles.analysisActionButton} ${
                      appliedDescriptionAssetId === asset.id ? styles.appliedButton : ""
                    }`}
                    disabled={asset.reviewStatus !== "approved"}
                    type="submit"
                  >
                    {appliedDescriptionAssetId === asset.id ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Applied</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>Apply copy</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.emptyAnalysis}>
          <Sparkles size={24} />
          <strong>No generated descriptions yet</strong>
          <p>Run the listing assistant from AI Tools. Generated copy will appear here for human review before publishing.</p>
        </div>
      )}
    </section>
  );
}

function buildDescriptionAssetTitle(items: GeneratedPropertyDescription[]) {
  if (!items.length) {
    return "Waiting for generated copy";
  }

  const approved = items.filter((item) => item.reviewStatus === "approved").length;
  const draft = items.filter((item) => item.reviewStatus === "draft").length;

  return `${items.length} generated drafts, ${draft} awaiting review, ${approved} approved`;
}
