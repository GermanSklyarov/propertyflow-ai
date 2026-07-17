import type {
  PropertySocialPostChannel,
  PropertySocialPostDraft,
  PropertySocialPostPublication,
  PropertySocialPostReview
} from "@propertyflow/contracts";

export function findDraftPublication(draft: PropertySocialPostDraft, publications: PropertySocialPostPublication[]) {
  return publications.find(
    (publication) =>
      publication.channel === draft.channel &&
      publication.locale === draft.locale &&
      publication.trackingSlug === draft.publicationPlan.trackingSlug
  );
}

export function findDraftReview(draft: PropertySocialPostDraft, reviews: PropertySocialPostReview[]) {
  return reviews.find(
    (review) =>
      review.channel === draft.channel &&
      review.locale === draft.locale &&
      review.trackingSlug === draft.publicationPlan.trackingSlug
  );
}

export function formatSocialPostChannel(channel: PropertySocialPostChannel) {
  return channel === "line-voom" ? "LINE VOOM" : channel === "facebook" ? "Facebook" : "Instagram";
}

export function formatSocialPostPublishedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function shortenSocialPostTrackingSlug(value: string) {
  return value.length > 34 ? `${value.slice(0, 15)}...${value.slice(-12)}` : value;
}
