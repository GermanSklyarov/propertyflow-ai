import { listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ListingsPage } from "@views/listings/ui/listings-page";

export default async function AgencyListingsPage() {
  const queryClient = createPropertyFlowQueryClient();
  const listings = await queryClient.ensureQueryData(listingsQueryOptions());

  return <ListingsPage listings={listings.items} total={listings.total} />;
}
