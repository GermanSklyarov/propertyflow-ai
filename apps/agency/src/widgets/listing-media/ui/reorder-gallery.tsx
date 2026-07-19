"use client";

import { ChevronLeft, ChevronRight, GripVertical, Save } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { moveGalleryItem, moveGalleryItemByStep } from "../model/reorder-gallery";
import styles from "./listing-media-panel.module.css";

interface ReorderGalleryItem {
  caption: string;
  id: string;
  src: string;
}

export function ReorderGallery({
  action,
  images
}: {
  action: (imageIds: string[]) => Promise<void>;
  images: ReorderGalleryItem[];
}) {
  const [items, setItems] = useState(images);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const initialIds = useMemo(() => images.map((image) => image.id).join("|"), [images]);
  const currentIds = items.map((image) => image.id).join("|");
  const isDirty = currentIds !== initialIds;

  useEffect(() => {
    setItems(images);
    setStatus("idle");
  }, [images]);

  if (images.length < 2) {
    return null;
  }

  function moveItem(sourceId: string, targetId: string) {
    setItems((current) => moveGalleryItem(current, sourceId, targetId));
    setStatus("idle");
  }

  function moveItemByStep(itemId: string, step: -1 | 1) {
    setItems((current) => moveGalleryItemByStep(current, itemId, step));
    setStatus("idle");
  }

  function saveOrder() {
    startTransition(async () => {
      try {
        await action(items.map((item) => item.id));
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div className={styles.reorderPanel}>
      <div className={styles.reorderHeader}>
        <div>
          <p className="section-kicker">Reorder queue</p>
          <h3>Drag photos into publishing order</h3>
        </div>
        <button disabled={!isDirty || isPending} onClick={saveOrder} type="button">
          <Save size={15} />
          {isPending ? "Saving" : status === "saved" ? "Saved" : "Save order"}
        </button>
      </div>

      <div className={styles.reorderList} aria-label="Draggable listing image order">
        {items.map((image, index) => (
          <div
            className={`${styles.reorderItem} ${draggedId === image.id ? styles.reorderItemDragging : ""}`}
            draggable
            key={image.id}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => {
              event.preventDefault();

              if (draggedId) {
                moveItem(draggedId, image.id);
              }
            }}
            onDragStart={() => setDraggedId(image.id)}
          >
            <span className={styles.reorderPosition}>{index === 0 ? "Cover" : index + 1}</span>
            <img src={image.src} alt={image.caption} />
            <strong>{image.caption}</strong>
            <div className={styles.reorderControls}>
              <button
                aria-label={`Move ${image.caption} earlier`}
                disabled={index === 0}
                onClick={() => moveItemByStep(image.id, -1)}
                title="Move earlier"
                type="button"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                aria-label={`Move ${image.caption} later`}
                disabled={index === items.length - 1}
                onClick={() => moveItemByStep(image.id, 1)}
                title="Move later"
                type="button"
              >
                <ChevronRight size={15} />
              </button>
              <GripVertical size={18} aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>

      {status === "error" ? <p className={styles.reorderError}>Could not save image order. Try again.</p> : null}
    </div>
  );
}
