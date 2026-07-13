import { Check, CheckCircle2, ScanSearch, Sparkles, X } from "lucide-react";
import {
  applyPropertyImageAnalysisAction,
  reviewPropertyImageAnalysisAction
} from "@entities/listing/api/listing-actions";
import { buildGalleryImageSrc } from "@entities/listing/lib/listing-media";
import type { PropertyImageAnalysisResult, PropertyImageGalleryResponse } from "@propertyflow/contracts";
import { formatBucket, formatPercent } from "@shared/lib/formatters";
import styles from "./listing-image-analysis-review-panel.module.css";

export function ListingImageAnalysisReviewPanel({
  activeImageCount,
  appliedImageAnalysisAssetId,
  gallery,
  imageAnalysis,
  propertyId,
  queuedImageAnalysis = false
}: {
  activeImageCount: number;
  appliedImageAnalysisAssetId?: string;
  gallery: PropertyImageGalleryResponse;
  imageAnalysis: PropertyImageAnalysisResult[];
  propertyId: string;
  queuedImageAnalysis?: boolean;
}) {
  const emptyCopy = buildImageAnalysisEmptyCopy(activeImageCount);
  const galleryImagesById = new Map(gallery.images.map((image) => [image.id, image]));

  return (
    <section className={styles.panel} id="ai-image-analysis">
      <div className={styles.panelHeader}>
        <div>
          <p className="section-kicker">AI image analysis</p>
          <h2 className={styles.panelTitle}>{buildImageAnalysisTitle(imageAnalysis, activeImageCount)}</h2>
        </div>
        <ScanSearch size={20} />
      </div>
      {queuedImageAnalysis ? (
        <div className={styles.analysisNotice}>
          <Sparkles size={18} />
          <div>
            <strong>Photo added to the analysis queue</strong>
            <p>The gallery has the uploaded image now. Keep the worker running and review the AI result here once it finishes.</p>
          </div>
        </div>
      ) : null}
      {imageAnalysis.length ? (
        <div className={styles.analysisGrid}>
          {imageAnalysis.map((asset) => {
            const linkedImage = asset.propertyImageId ? galleryImagesById.get(asset.propertyImageId) : undefined;
            const imageSrc = linkedImage ? buildGalleryImageSrc(linkedImage) : asset.imageUrl;

            return (
              <article className={styles.analysisCard} key={asset.id}>
                <img src={imageSrc} alt={linkedImage?.caption ?? "AI analyzed listing photo"} />
                <div>
                  <span className={`${styles.analysisStatus} ${styles[`analysis-${asset.reviewStatus}`]}`}>
                    {formatBucket(asset.reviewStatus)}
                  </span>
                  <strong>{formatPercent(asset.confidence, { maximumFractionDigits: 0 })} confidence</strong>
                  <div className={styles.analysisFeatures}>
                    {asset.detectedFeatures.length ? (
                      asset.detectedFeatures.map((feature) => <span key={feature}>{formatBucket(feature)}</span>)
                    ) : (
                      <span>No features detected</span>
                    )}
                  </div>
                  <div className={styles.analysisActions}>
                    <form action={reviewPropertyImageAnalysisAction.bind(null, propertyId, asset.id, "approved")}>
                      <button className={`${styles.analysisActionButton} ${styles.approveButton}`} type="submit">
                        <Check size={14} />
                        <span>Approve</span>
                      </button>
                    </form>
                    <form action={reviewPropertyImageAnalysisAction.bind(null, propertyId, asset.id, "rejected")}>
                      <button className={`${styles.analysisActionButton} ${styles.rejectButton}`} type="submit">
                        <X size={14} />
                        <span>Reject</span>
                      </button>
                    </form>
                    <form action={applyPropertyImageAnalysisAction.bind(null, propertyId, asset.id)}>
                      <button
                        className={`${styles.analysisActionButton} ${
                          appliedImageAnalysisAssetId === asset.id ? styles.appliedButton : ""
                        }`}
                        disabled={asset.reviewStatus !== "approved"}
                        type="submit"
                      >
                        {appliedImageAnalysisAssetId === asset.id ? (
                          <>
                            <CheckCircle2 size={14} />
                            <span>Applied</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>Apply features</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyAnalysis}>
          <ScanSearch size={24} />
          <strong>{emptyCopy.title}</strong>
          <p>{emptyCopy.body}</p>
        </div>
      )}
    </section>
  );
}

function buildImageAnalysisTitle(items: PropertyImageAnalysisResult[], activeImageCount: number) {
  if (!items.length) {
    if (activeImageCount) {
      return `Analysis queued for ${activeImageCount} photos`;
    }

    return "Waiting for analyzed photos";
  }

  const approved = items.filter((item) => item.reviewStatus === "approved").length;
  const draft = items.filter((item) => item.reviewStatus === "draft").length;

  return `${items.length} analyzed photos, ${draft} awaiting review, ${approved} approved`;
}

function buildImageAnalysisEmptyCopy(activeImageCount: number) {
  if (activeImageCount) {
    return {
      body: "Photos are already in the gallery. Keep the background worker running so BullMQ can turn queued analysis jobs into reviewable AI assets.",
      title: "Image analysis is queued"
    };
  }

  return {
    body: "Upload a photo with AI analysis enabled. Results will appear here for review before they update amenities.",
    title: "No image analysis assets yet"
  };
}
