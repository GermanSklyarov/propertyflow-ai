import { parseListingIntent } from "@features/listing-intent-filter/model/listing-intent";
import { HomePage } from "@views/home/ui/home-page";

export default async function Page({ searchParams }: { searchParams: Promise<{ intent?: string | string[] }> }) {
  const { intent } = await searchParams;

  return <HomePage initialListingIntent={parseListingIntent(intent)} />;
}
