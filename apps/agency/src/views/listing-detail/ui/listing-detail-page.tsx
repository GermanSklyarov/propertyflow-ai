import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { formatProjectStatus } from "@entities/listing/lib/listing-formatters";
import { buildListingMediaSummary } from "@entities/listing/lib/listing-media";
import {
  buildListingNextActions,
  buildListingPublicationSummary,
  buildListingReadiness
} from "@entities/listing/lib/listing-readiness";
import { ListingAiDescriptionReviewPanel } from "@features/listing-ai-description-review/ui/listing-ai-description-review-panel";
import { ListingImageAnalysisReviewPanel } from "@features/listing-image-analysis-review/ui/listing-image-analysis-review-panel";
import { ListingProjectUpdatePanel } from "@features/listing-project-update/ui/listing-project-update-panel";
import type {
  PropertyAiAssets,
  PropertyImageGalleryResponse,
  PropertySocialPostChannel,
  PropertySocialPostDraft,
  PropertySocialPostLocale
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket } from "@shared/lib/formatters";
import { ListingAgentGuidancePanel } from "@widgets/listing-agent-guidance/ui/listing-agent-guidance-panel";
import { ListingAmenitiesPanel } from "@widgets/listing-amenities/ui/listing-amenities-panel";
import { ListingMediaPanel } from "@widgets/listing-media/ui/listing-media-panel";
import { ListingOverviewPanel } from "@widgets/listing-overview/ui/listing-overview-panel";
import { ListingPublicationPanel } from "@widgets/listing-publication/ui/listing-publication-panel";
import { ListingSocialPostsPanel } from "@widgets/listing-social-posts/ui/listing-social-posts-panel";
import styles from "./listing-detail-page.module.css";

export function ListingDetailPage({
  appliedDescriptionAssetId,
  appliedImageAnalysisAssetId,
  amenitiesUpdated,
  aiAssets,
  gallery,
  listing,
  selectedSocialChannels,
  selectedSocialLocale,
  socialPostDrafts,
  queuedImageAnalysis = false
}: {
  appliedDescriptionAssetId?: string;
  appliedImageAnalysisAssetId?: string;
  amenitiesUpdated?: boolean;
  aiAssets: PropertyAiAssets;
  gallery: PropertyImageGalleryResponse;
  listing: PropertySnapshot;
  selectedSocialChannels: PropertySocialPostChannel[];
  selectedSocialLocale: PropertySocialPostLocale;
  socialPostDrafts: PropertySocialPostDraft[];
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
            {listing.project ? (
              <p className={`${styles.projectLine} section-kicker`}>
                {listing.project.name} · {formatProjectStatus(listing.project.status)}
                {listing.project.developer ? ` · ${listing.project.developer}` : ""}
              </p>
            ) : null}
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

        <ListingProjectUpdatePanel listing={listing} />

        <ListingPublicationPanel publication={publication} />

        <ListingSocialPostsPanel
          drafts={socialPostDrafts}
          propertyId={listing.id}
          selectedChannels={selectedSocialChannels}
          selectedLocale={selectedSocialLocale}
        />

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

        <ListingAmenitiesPanel
          amenities={listing.amenities}
          appliedImageAnalysisAssetId={appliedImageAnalysisAssetId}
          listingId={listing.id}
          updated={amenitiesUpdated}
        />
      </div>
    </main>
  );
}
