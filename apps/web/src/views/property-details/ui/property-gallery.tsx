"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import styles from "./property-gallery.module.css";

export type PropertyGalleryImage = {
  alt: string;
  caption: string;
  id: string;
  isCover: boolean;
  src: string;
};

export function PropertyGallery({ images }: { images: PropertyGalleryImage[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const desktopPreviewImages = useMemo(() => images.slice(0, 5), [images]);
  const resolvedActiveIndex = activeIndex ?? 0;
  const activeImage = activeIndex === null ? null : images[resolvedActiveIndex];
  const hasManyImages = images.length > desktopPreviewImages.length;

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveIndex(null);
      }

      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => getPreviousIndex(current ?? 0, images.length));
      }

      if (event.key === "ArrowRight") {
        setActiveIndex((current) => getNextIndex(current ?? 0, images.length));
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, images.length]);

  if (!images.length) {
    return null;
  }

  return (
    <>
      <div className={styles.mobileCarousel} aria-label="Swipe property photos">
        {images.map((image, index) => (
          <button className={styles.mobileSlide} key={image.id} onClick={() => setActiveIndex(index)} type="button">
            <img src={image.src} alt={image.alt} />
            <span>{image.caption}</span>
          </button>
        ))}
      </div>

      <div className={styles.desktopGrid} aria-label="Property photo previews">
        {desktopPreviewImages.map((image, index) => {
          const isLastVisible = index === desktopPreviewImages.length - 1;

          return (
            <button
              className={`${styles.desktopTile} ${index === 0 ? styles.desktopHero : ""}`}
              key={image.id}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <img src={image.src} alt={image.alt} />
              <span className={styles.tileCaption}>{image.caption}</span>
              {isLastVisible && hasManyImages ? (
                <span className={styles.viewAllOverlay}>
                  <Expand size={18} />
                  View all {images.length} photos
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {activeImage ? (
        <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label="Property photo viewer">
          <button className={styles.lightboxBackdrop} onClick={() => setActiveIndex(null)} type="button" aria-label="Close gallery" />
          <div className={styles.lightboxPanel}>
            <div className={styles.lightboxTopbar}>
              <span>
                {resolvedActiveIndex + 1} / {images.length}
              </span>
              <button className={styles.iconButton} onClick={() => setActiveIndex(null)} type="button" aria-label="Close gallery">
                <X size={22} />
              </button>
            </div>
            {images.length > 1 ? (
              <button
                className={`${styles.navButton} ${styles.navPrevious}`}
                onClick={() => setActiveIndex(getPreviousIndex(resolvedActiveIndex, images.length))}
                type="button"
                aria-label="Previous photo"
              >
                <ChevronLeft size={28} />
              </button>
            ) : null}
            <img className={styles.lightboxImage} src={activeImage.src} alt={activeImage.alt} />
            {images.length > 1 ? (
              <button
                className={`${styles.navButton} ${styles.navNext}`}
                onClick={() => setActiveIndex(getNextIndex(resolvedActiveIndex, images.length))}
                type="button"
                aria-label="Next photo"
              >
                <ChevronRight size={28} />
              </button>
            ) : null}
            <div className={styles.lightboxCaption}>{activeImage.caption}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function getPreviousIndex(currentIndex: number, imageCount: number) {
  return currentIndex === 0 ? imageCount - 1 : currentIndex - 1;
}

function getNextIndex(currentIndex: number, imageCount: number) {
  return currentIndex === imageCount - 1 ? 0 : currentIndex + 1;
}
