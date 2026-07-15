import type { PropertyImageGalleryResponse } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";

export function buildListingMediaSummary(gallery: PropertyImageGalleryResponse) {
  const activeImages = [...gallery.images]
    .filter((image) => !image.deletedAt)
    .sort((first, second) => first.position - second.position);
  const cover = activeImages[0];

  return {
    activeCount: activeImages.length,
    cover,
    thumbnails: activeImages.slice(1),
    title: activeImages.length ? "Published gallery preview" : "No photos attached yet"
  };
}

export function buildGalleryImageSrc(image: PropertyImageGalleryResponse["images"][number]) {
  if (!image.objectKey) {
    return image.imageUrl;
  }

  return `/api/listing-images/${encodeURIComponent(image.propertyId)}/${encodeURIComponent(image.id)}`;
}

export function buildListingCoverImageSrc(listing: PropertySnapshot) {
  if (!listing.coverImage) {
    return fallbackListingCoverImage(listing);
  }

  if (!listing.coverImage.objectKey) {
    return listing.coverImage.imageUrl;
  }

  return `/api/listing-images/${encodeURIComponent(listing.id)}/${encodeURIComponent(listing.coverImage.id)}`;
}

function fallbackListingCoverImage(listing: PropertySnapshot) {
  if (listing.kind === "villa") {
    return "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=700&q=80";
  }

  if (listing.market === "phuket" || listing.market === "koh-samui") {
    return "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=700&q=80";
  }

  if (listing.market === "bangkok") {
    return "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=700&q=80";
  }

  return "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=700&q=80";
}
