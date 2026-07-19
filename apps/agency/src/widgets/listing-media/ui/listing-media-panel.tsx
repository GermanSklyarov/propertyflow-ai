import { ChevronDown, ImagePlus } from "lucide-react";
import {
  addPropertyImageAction,
  deletePropertyImageAction,
  makePropertyImageCoverAction,
  reorderPropertyImagesAction,
  restorePropertyImageAction,
  uploadPropertyImageAction
} from "@entities/listing/api/listing-actions";
import { buildGalleryImageSrc, buildListingMediaSummary } from "@entities/listing/lib/listing-media";
import type { PropertyImageGalleryResponse } from "@propertyflow/contracts";
import { FileDropField } from "@shared/ui/file-drop-field";
import { DeleteImageButton } from "./delete-image-button";
import { MakeCoverButton } from "./make-cover-button";
import { ReorderGallery } from "./reorder-gallery";
import { RestoreImageButton } from "./restore-image-button";
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
  const deletedImages = gallery.deletedImages ?? [];
  const addImage = addPropertyImageAction.bind(null, listingId);
  const uploadImage = uploadPropertyImageAction.bind(null, listingId);
  const reorderImages = reorderPropertyImagesAction.bind(null, listingId);

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
            <DeleteImageButton action={deletePropertyImageAction.bind(null, listingId, media.cover.id)} />
            <figcaption>
              <span>Cover</span>
              <strong>{media.cover.caption ?? listingTitle}</strong>
            </figcaption>
          </figure>

          <div className={styles.thumbnailGrid}>
            {media.thumbnails.map((image, index) => (
              <figure className={styles.thumbnailFrame} key={image.id}>
                <img src={buildGalleryImageSrc(image)} alt={image.caption ?? `${listingTitle} photo ${index + 2}`} />
                <MakeCoverButton action={makePropertyImageCoverAction.bind(null, listingId, image.id)} />
                <DeleteImageButton action={deletePropertyImageAction.bind(null, listingId, image.id)} />
                <figcaption>{index === 0 ? "Next in gallery" : `Photo ${index + 2}`}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : (
        <a className={styles.empty} href="#add-photos">
          <ImagePlus size={28} />
          <strong>Upload photos before publishing</strong>
          <p>Click to add photos by URL or upload local files. Photos will power the public gallery, AI image analysis, and recommendations.</p>
        </a>
      )}

      <div className={styles.actions}>
        <span>Cover can be changed from thumbnails</span>
        <span>Drag order can be saved</span>
        <span>AI quality review</span>
        <span>Public gallery sync</span>
      </div>

      <ReorderGallery
        action={reorderImages}
        images={gallery.images.map((image, index) => ({
          caption: image.caption ?? (index === 0 ? `${listingTitle} cover photo` : `${listingTitle} photo ${index + 1}`),
          id: image.id,
          src: buildGalleryImageSrc(image)
        }))}
      />

      {deletedImages.length ? (
        <div className={styles.deletedImages}>
          <div className={styles.deletedHeader}>
            <div>
              <p className="section-kicker">Recently deleted</p>
              <h3>Recover removed photos</h3>
            </div>
            <span>{deletedImages.length} deleted</span>
          </div>
          <div className={styles.deletedGrid}>
            {deletedImages.map((image, index) => (
              <figure className={styles.deletedFrame} key={image.id}>
                <img src={buildGalleryImageSrc(image)} alt={image.caption ?? `${listingTitle} deleted photo ${index + 1}`} />
                <figcaption>
                  <strong>{image.caption ?? `Photo ${image.position + 1}`}</strong>
                  <span>{image.deletedAt ? `Deleted ${formatDeletedDate(image.deletedAt)}` : "Deleted"}</span>
                </figcaption>
                <RestoreImageButton action={restorePropertyImageAction.bind(null, listingId, image.id)} />
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      <details className={styles.addPhotosPanel} id="add-photos" open={!media.activeCount}>
        <summary>
          <ImagePlus size={16} />
          <span>Add photos</span>
          <ChevronDown size={16} />
        </summary>
        <div className={styles.addPhotosBody}>
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

          <form action={uploadImage} className={`${styles.form} ${styles.uploadForm}`}>
            <div className={styles.uploadIntro}>
              <p className="section-kicker">Upload</p>
              <h3>Upload local file</h3>
            </div>
            <FileDropField
              accept="image/*"
              className={styles.uploadDrop}
              description="Drop one listing photo here. It is added to the gallery and can be queued for AI image analysis."
              icon={<ImagePlus size={18} />}
              name="imageFile"
              required
              title="Drop image file"
              variant="compact"
            />
            <div className={styles.uploadDetails}>
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
            </div>
          </form>
        </div>
      </details>
    </section>
  );
}

function formatDeletedDate(value: string) {
  return value.slice(0, 10);
}
