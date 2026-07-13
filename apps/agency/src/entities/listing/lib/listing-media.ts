import type { PropertyImageGalleryResponse } from "@propertyflow/contracts";

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
