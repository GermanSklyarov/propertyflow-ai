import { notFound } from "next/navigation";
import {
  listingAiAssetsQueryOptions,
  listingDetailQueryOptions,
  listingImagesQueryOptions,
  listingSocialPostsQueryOptions
} from "@entities/listing/api/listing-queries";
import { buildListingMediaSummary } from "@entities/listing/lib/listing-media";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ListingDetailPage } from "@views/listing-detail/ui/listing-detail-page";

export default async function AgencyListingDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ amenities?: string; applied?: string; asset?: string; queued?: string }>;
}) {
  const { propertyId } = await params;
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const [listing, gallery, aiAssets] = await Promise.all([
    queryClient.ensureQueryData(listingDetailQueryOptions(propertyId)),
    queryClient.ensureQueryData(listingImagesQueryOptions(propertyId)),
    queryClient.ensureQueryData(listingAiAssetsQueryOptions(propertyId))
  ]);

  if (!listing) {
    notFound();
  }

  const media = buildListingMediaSummary(gallery);
  const socialPosts = await queryClient.ensureQueryData(
    listingSocialPostsQueryOptions(propertyId, {
      publicPhotoCount: media.activeCount
    })
  );

  return (
    <ListingDetailPage
      aiAssets={aiAssets}
      appliedDescriptionAssetId={query.applied === "description" ? query.asset : undefined}
      gallery={gallery}
      listing={listing}
      socialPostDrafts={socialPosts.drafts}
      appliedImageAnalysisAssetId={query.applied === "image-features" ? query.asset : undefined}
      amenitiesUpdated={query.amenities === "updated"}
      queuedImageAnalysis={query.queued === "image-analysis"}
    />
  );
}
