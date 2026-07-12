import { notFound } from "next/navigation";
import {
  listingAiAssetsQueryOptions,
  listingDetailQueryOptions,
  listingImagesQueryOptions
} from "@entities/listing/api/listing-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ListingDetailPage } from "@views/listing-detail/ui/listing-detail-page";

export default async function AgencyListingDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ applied?: string; asset?: string; queued?: string }>;
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

  return (
    <ListingDetailPage
      aiAssets={aiAssets}
      gallery={gallery}
      listing={listing}
      appliedImageAnalysisAssetId={query.applied === "image-features" ? query.asset : undefined}
      queuedImageAnalysis={query.queued === "image-analysis"}
    />
  );
}
