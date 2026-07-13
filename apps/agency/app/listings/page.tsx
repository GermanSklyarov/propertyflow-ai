import { listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ListingsPage } from "@views/listings/ui/listings-page";

export default async function AgencyListingsPage({
  searchParams
}: {
  searchParams: Promise<{ failed?: string; imported?: string; limit?: string }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const listings = await queryClient.ensureQueryData(listingsQueryOptions());
  const imported = Number(query.imported);
  const failed = Number(query.failed);
  const importResult =
    Number.isFinite(imported) && Number.isFinite(failed)
      ? {
          failed,
          imported,
          limitedTo: query.limit ? Number(query.limit) : undefined
        }
      : undefined;

  return <ListingsPage importResult={importResult} listings={listings.items} total={listings.total} />;
}
