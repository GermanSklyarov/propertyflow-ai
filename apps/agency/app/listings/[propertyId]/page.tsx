import { notFound } from "next/navigation";
import { listingDetailQueryOptions } from "@entities/listing/api/listing-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ListingDetailPage } from "@views/listing-detail/ui/listing-detail-page";

export default async function AgencyListingDetailPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const queryClient = createPropertyFlowQueryClient();
  const listing = await queryClient.ensureQueryData(listingDetailQueryOptions(propertyId));

  if (!listing) {
    notFound();
  }

  return <ListingDetailPage listing={listing} />;
}
