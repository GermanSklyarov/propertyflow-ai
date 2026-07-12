import { notFound } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { propertyDetailQueryOptions, propertyImagesQueryOptions } from "@entities/property/api/property-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PropertyDetailsPage } from "@views/property-details/ui/property-details-page";

export default async function PropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { propertyId } = await params;
  const { from } = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const [property, gallery] = await Promise.all([
    queryClient.ensureQueryData(propertyDetailQueryOptions(propertyId)),
    queryClient.ensureQueryData(propertyImagesQueryOptions(propertyId))
  ]);

  if (!property) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PropertyDetailsPage
        backHref={
          from === "concierge"
            ? "/#concierge-recommendations"
            : "/#recommendations"
        }
        gallery={gallery}
        property={property}
      />
    </HydrationBoundary>
  );
}
