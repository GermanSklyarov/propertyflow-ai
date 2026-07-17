import { notFound } from "next/navigation";
import type { PropertySocialPostChannel, PropertySocialPostLocale } from "@propertyflow/contracts";
import {
  listingAiAssetsQueryOptions,
  listingDetailQueryOptions,
  listingImagesQueryOptions,
  listingSocialPostPublicationsQueryOptions,
  listingSocialPostsQueryOptions
} from "@entities/listing/api/listing-queries";
import { buildListingMediaSummary } from "@entities/listing/lib/listing-media";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ListingDetailPage } from "@views/listing-detail/ui/listing-detail-page";

export default async function AgencyListingDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{
    amenities?: string;
    applied?: string;
    asset?: string;
    queued?: string;
    socialChannel?: string | string[];
    socialLocale?: string;
  }>;
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

  const media = buildListingMediaSummary(gallery);
  const socialLocale = parseSocialLocale(query.socialLocale);
  const socialChannels = parseSocialChannels(query.socialChannel);
  const [socialPosts, socialPublications] = await Promise.all([
    queryClient.ensureQueryData(
      listingSocialPostsQueryOptions(propertyId, {
        channels: socialChannels,
        locale: socialLocale,
        publicPhotoCount: media.activeCount
      })
    ),
    queryClient.ensureQueryData(listingSocialPostPublicationsQueryOptions(propertyId))
  ]);

  return (
    <ListingDetailPage
      aiAssets={aiAssets}
      appliedDescriptionAssetId={query.applied === "description" ? query.asset : undefined}
      gallery={gallery}
      listing={listing}
      selectedSocialChannels={socialChannels}
      selectedSocialLocale={socialLocale}
      socialPostDrafts={socialPosts.drafts}
      socialPostPublications={socialPublications}
      appliedImageAnalysisAssetId={query.applied === "image-features" ? query.asset : undefined}
      amenitiesUpdated={query.amenities === "updated"}
      queuedImageAnalysis={query.queued === "image-analysis"}
    />
  );
}

function parseSocialLocale(value: string | undefined): PropertySocialPostLocale {
  return value === "ru" || value === "th" || value === "zh" ? value : "en";
}

function parseSocialChannels(value: string | string[] | undefined): PropertySocialPostChannel[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const channels = values.filter((item): item is PropertySocialPostChannel =>
    item === "line-voom" || item === "facebook" || item === "instagram"
  );

  return channels.length ? channels : ["line-voom", "facebook", "instagram"];
}
