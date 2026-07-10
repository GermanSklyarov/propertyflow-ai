import { listFeaturedProperties } from "../../../shared/api/propertyflow-client";
import { CompareBand } from "../../../widgets/compare-band/ui/compare-band";
import { HomeHero } from "../../../widgets/home-hero/ui/home-hero";
import { MarketStrip } from "../../../widgets/market-strip/ui/market-strip";
import { PropertyFeed } from "../../../widgets/property-feed/ui/property-feed";

export async function HomePage() {
  const properties = await listFeaturedProperties();

  return (
    <main>
      <HomeHero properties={properties} />
      <MarketStrip />
      <PropertyFeed properties={properties} />
      <CompareBand properties={properties} />
    </main>
  );
}
