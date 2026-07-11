import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { featuredPropertiesQueryOptions } from "@entities/property/api/property-queries";
import type { ListingIntent } from "@features/listing-intent-filter/model/listing-intent";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { CompareBand } from "@widgets/compare-band/ui/compare-band";
import { HomeHero } from "@widgets/home-hero/ui/home-hero";
import { MarketStrip } from "@widgets/market-strip/ui/market-strip";
import { PropertyFeed } from "@widgets/property-feed/ui/property-feed";

export async function HomePage({ initialListingIntent = "all" }: { initialListingIntent?: ListingIntent }) {
  const queryClient = createPropertyFlowQueryClient();
  const properties = await queryClient.ensureQueryData(featuredPropertiesQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main>
        <HomeHero properties={properties} />
        <MarketStrip properties={properties} />
        <PropertyFeed initialListingIntent={initialListingIntent} properties={properties} />
        <CompareBand properties={properties} />
      </main>
    </HydrationBoundary>
  );
}
