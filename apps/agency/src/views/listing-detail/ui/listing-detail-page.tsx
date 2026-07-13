import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { buildListingMediaSummary } from "@entities/listing/lib/listing-media";
import {
  buildListingNextActions,
  buildListingPublicationSummary,
  buildListingReadiness
} from "@entities/listing/lib/listing-readiness";
import { ListingAiDescriptionReviewPanel } from "@features/listing-ai-description-review/ui/listing-ai-description-review-panel";
import { ListingImageAnalysisReviewPanel } from "@features/listing-image-analysis-review/ui/listing-image-analysis-review-panel";
import type { PropertyAiAssets, PropertyImageGalleryResponse } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket } from "@shared/lib/formatters";
import { ListingAgentGuidancePanel } from "@widgets/listing-agent-guidance/ui/listing-agent-guidance-panel";
import { ListingAmenitiesPanel } from "@widgets/listing-amenities/ui/listing-amenities-panel";
import { ListingMediaPanel } from "@widgets/listing-media/ui/listing-media-panel";
import { ListingOverviewPanel } from "@widgets/listing-overview/ui/listing-overview-panel";
import { ListingPublicationPanel } from "@widgets/listing-publication/ui/listing-publication-panel";
import styles from "./listing-detail-page.module.css";

export function ListingDetailPage({
  appliedDescriptionAssetId,
  appliedImageAnalysisAssetId,
  aiAssets,
  gallery,
  listing,
  queuedImageAnalysis = false
}: {
  appliedDescriptionAssetId?: string;
  appliedImageAnalysisAssetId?: string;
  aiAssets: PropertyAiAssets;
  gallery: PropertyImageGalleryResponse;
  listing: PropertySnapshot;
  queuedImageAnalysis?: boolean;
}) {
  const media = buildListingMediaSummary(gallery);
  const publication = buildListingPublicationSummary(listing, media.activeCount);
  const readiness = buildListingReadiness(listing);
  const nextActions = buildListingNextActions(listing, readiness.score);

  return (
    <main className={styles.page} id="listing-brief">
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/listings">
              <ArrowLeft size={16} />
              Back to listings
            </Link>
            <p className="section-kicker">Listing workspace</p>
            <h1 className={styles.title}>{listing.title}</h1>
            <p className={styles.subtitle}>{listing.description ?? "No description yet. Run AI enrichment before publishing."}</p>
          </div>
          <span className={`${styles.statusBadge} ${styles[`status-${listing.status}`]}`}>{formatBucket(listing.status)}</span>
        </header>
        {appliedDescriptionAssetId ? (
          <div className={styles.descriptionAppliedNotice}>
            <CheckCircle2 size={18} />
            <div>
              <strong>AI description applied</strong>
              <p>The listing title and public description were updated from the approved generated copy.</p>
            </div>
          </div>
        ) : null}

        <ListingMediaPanel gallery={gallery} listingId={listing.id} listingTitle={listing.title} />

        <ListingOverviewPanel listing={listing} readiness={readiness} />

        <ListingPublicationPanel publication={publication} />

        <ListingAgentGuidancePanel nextActions={nextActions} readiness={readiness} />

        <ListingAiDescriptionReviewPanel
          appliedDescriptionAssetId={appliedDescriptionAssetId}
          descriptions={aiAssets.descriptions}
          propertyId={listing.id}
        />

        <ListingImageAnalysisReviewPanel
          activeImageCount={media.activeCount}
          appliedImageAnalysisAssetId={appliedImageAnalysisAssetId}
          gallery={gallery}
          imageAnalysis={aiAssets.imageAnalysis}
          propertyId={listing.id}
          queuedImageAnalysis={queuedImageAnalysis}
        />

        <ListingAmenitiesPanel amenities={listing.amenities} appliedImageAnalysisAssetId={appliedImageAnalysisAssetId} />
      </div>
    </main>
  );
}
