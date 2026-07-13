import { ImagePlus } from "lucide-react";
import { addPropertyImageAction, uploadPropertyImageAction } from "@entities/listing/api/listing-actions";
import { buildGalleryImageSrc, buildListingMediaSummary } from "@entities/listing/lib/listing-media";
import type { PropertyImageGalleryResponse } from "@propertyflow/contracts";
import styles from "./listing-media-panel.module.css";

export function ListingMediaPanel({
  gallery,
  listingId,
  listingTitle
}: {
  gallery: PropertyImageGalleryResponse;
  listingId: string;
  listingTitle: string;
}) {
  const media = buildListingMediaSummary(gallery);
  const addImage = addPropertyImageAction.bind(null, listingId);
  const uploadImage = uploadPropertyImageAction.bind(null, listingId);

  return (
    <section className={styles.panel} aria-label="Listing media gallery">
      <div className={styles.header}>
        <div>
          <p className="section-kicker">Media</p>
          <h2 className={styles.title}>{media.title}</h2>
        </div>
        <span className={styles.count}>{media.activeCount} photos</span>
      </div>

      {media.cover ? (
        <div className={styles.galleryGrid}>
          <figure className={styles.coverFrame}>
            <img src={buildGalleryImageSrc(media.cover)} alt={media.cover.caption ?? `${listingTitle} cover photo`} />
            <figcaption>
              <span>Cover</span>
              <strong>{media.cover.caption ?? listingTitle}</strong>
            </figcaption>
          </figure>

          <div className={styles.thumbnailGrid}>
            {media.thumbnails.map((image, index) => (
              <figure className={styles.thumbnailFrame} key={image.id}>
                <img src={buildGalleryImageSrc(image)} alt={image.caption ?? `${listingTitle} photo ${index + 2}`} />
                <figcaption>{index === 0 ? "Next in gallery" : `Photo ${index + 2}`}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.empty}>
          <ImagePlus size={28} />
          <strong>Upload photos before publishing</strong>
          <p>Photos will power the public listing gallery, AI image analysis, amenity detection, and client-facing recommendations.</p>
        </div>
      )}

      <div className={styles.actions}>
        <span>Cover selection</span>
        <span>Reorder queue</span>
        <span>AI quality review</span>
        <span>Public gallery sync</span>
      </div>

      <form action={addImage} className={styles.form}>
        <div>
          <p className="section-kicker">Add photo</p>
          <h3>Add image by URL</h3>
        </div>
        <label>
          Image URL
          <input name="imageUrl" placeholder="https://images.unsplash.com/..." required type="url" />
        </label>
        <label>
          Caption
          <input name="caption" placeholder="Sea-view balcony, renovated kitchen..." />
        </label>
        <label className={styles.checkboxLabel}>
          <input defaultChecked name="analyzeImage" type="checkbox" />
          Queue AI image analysis
        </label>
        <button type="submit">
          <ImagePlus size={16} />
          Add to gallery
        </button>
      </form>

      <form action={uploadImage} className={styles.form}>
        <div>
          <p className="section-kicker">Upload</p>
          <h3>Upload local file</h3>
        </div>
        <label>
          Image file
          <input accept="image/*" name="imageFile" required type="file" />
        </label>
        <label>
          Caption
          <input name="caption" placeholder="Pool view, living room, bedroom..." />
        </label>
        <label className={styles.checkboxLabel}>
          <input defaultChecked name="analyzeImage" type="checkbox" />
          Queue AI image analysis
        </label>
        <button type="submit">
          <ImagePlus size={16} />
          Upload to gallery
        </button>
      </form>
    </section>
  );
}
