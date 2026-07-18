import { notFound } from "next/navigation";
import type { PropertySocialPostChannel, PropertySocialPostLocale } from "@propertyflow/contracts";
import {
  listingAiAssetsQueryOptions,
  listingDetailQueryOptions,
  listingImagesQueryOptions,
  listingSocialPostPublicationsQueryOptions,
  listingSocialPostReviewsQueryOptions,
  listingSocialPostsQueryOptions
} from "@entities/listing/api/listing-queries";
import { listLeads } from "@shared/api/agency-client";
import { buildListingMediaSummary } from "@entities/listing/lib/listing-media";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { PageLoadState } from "@shared/ui/page-load-state";
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
  const [listingResult, galleryResult, aiAssetsResult] = await Promise.allSettled([
    queryClient.ensureQueryData(listingDetailQueryOptions(propertyId)),
    queryClient.ensureQueryData(listingImagesQueryOptions(propertyId)),
    queryClient.ensureQueryData(listingAiAssetsQueryOptions(propertyId))
  ]);

  if (listingResult.status === "rejected") {
    return (
      <PageLoadState
        kicker="Listing workspace unavailable"
        message={toErrorMessage(listingResult.reason)}
        title="Could not load listing"
        variant="error"
      />
    );
  }

  const listing = listingResult.value;

  if (!listing) {
    notFound();
  }

  const gallery = galleryResult.status === "fulfilled" ? galleryResult.value : undefined;
  const aiAssets = aiAssetsResult.status === "fulfilled" ? aiAssetsResult.value : undefined;
  const media = gallery ? buildListingMediaSummary(gallery) : null;
  const socialLocale = parseSocialLocale(query.socialLocale);
  const socialChannels = parseSocialChannels(query.socialChannel);
  const [socialPostsResult, socialPublicationsResult, socialReviewsResult, socialPostLeadsResult] = await Promise.allSettled([
    queryClient.ensureQueryData(
      listingSocialPostsQueryOptions(propertyId, {
        channels: socialChannels,
        locale: socialLocale,
        publicPhotoCount: media?.activeCount ?? 0
      })
    ),
    queryClient.ensureQueryData(listingSocialPostPublicationsQueryOptions(propertyId)),
    queryClient.ensureQueryData(listingSocialPostReviewsQueryOptions(propertyId)),
    listLeads({
      limit: 100,
      propertyId,
      source: "social-post"
    })
  ]);

  return (
    <ListingDetailPage
      aiAssets={aiAssets}
      aiAssetsError={aiAssetsResult.status === "rejected" ? toErrorMessage(aiAssetsResult.reason) : undefined}
      appliedDescriptionAssetId={query.applied === "description" ? query.asset : undefined}
      gallery={gallery}
      galleryError={galleryResult.status === "rejected" ? toErrorMessage(galleryResult.reason) : undefined}
      listing={listing}
      selectedSocialChannels={socialChannels}
      selectedSocialLocale={socialLocale}
      socialPostDrafts={socialPostsResult.status === "fulfilled" ? socialPostsResult.value.drafts : undefined}
      socialPostError={
        socialPostsResult.status === "rejected"
          ? toErrorMessage(socialPostsResult.reason)
          : socialPublicationsResult.status === "rejected"
            ? toErrorMessage(socialPublicationsResult.reason)
            : socialReviewsResult.status === "rejected"
              ? toErrorMessage(socialReviewsResult.reason)
              : socialPostLeadsResult.status === "rejected"
                ? toErrorMessage(socialPostLeadsResult.reason)
                : undefined
      }
      socialPostLeads={socialPostLeadsResult.status === "fulfilled" ? socialPostLeadsResult.value : undefined}
      socialPostPublications={socialPublicationsResult.status === "fulfilled" ? socialPublicationsResult.value : undefined}
      socialPostReviews={socialReviewsResult.status === "fulfilled" ? socialReviewsResult.value : undefined}
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

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load listing workspace";
}
