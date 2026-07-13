import { listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ListingsPage } from "@views/listings/ui/listings-page";

export default async function AgencyListingsPage({
  searchParams
}: {
  searchParams: Promise<{ importError?: "empty"; importJob?: string }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const listings = await queryClient.ensureQueryData(listingsQueryOptions());
  const importResult = query.importJob || query.importError ? { error: query.importError, jobId: query.importJob } : undefined;

  return <ListingsPage importResult={importResult} listings={listings.items} total={listings.total} />;
}
