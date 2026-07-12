import { notFound } from "next/navigation";
import {
  listingAiAssetsQueryOptions,
  listingDetailQueryOptions,
  listingImagesQueryOptions
} from "@entities/listing/api/listing-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ListingDetailPage } from "@views/listing-detail/ui/listing-detail-page";

export default async function AgencyListingDetailPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const queryClient = createPropertyFlowQueryClient();
  const [listing, gallery, aiAssets] = await Promise.all([
    queryClient.ensureQueryData(listingDetailQueryOptions(propertyId)),
    queryClient.ensureQueryData(listingImagesQueryOptions(propertyId)),
    queryClient.ensureQueryData(listingAiAssetsQueryOptions(propertyId))
  ]);

  if (!listing) {
    notFound();
  }

  return <ListingDetailPage aiAssets={aiAssets} gallery={gallery} listing={listing} />;
}
