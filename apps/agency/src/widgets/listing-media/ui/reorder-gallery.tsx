"use client";

import { GripVertical, Save } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
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
    if (sourceId === targetId) {
      return;
    }

    setItems((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceId);
      const targetIndex = current.findIndex((item) => item.id === targetId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }

      const next = [...current];
      const [source] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, source);
      return next;
    });
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
            <GripVertical size={18} />
          </div>
        ))}
      </div>

      {status === "error" ? <p className={styles.reorderError}>Could not save image order. Try again.</p> : null}
    </div>
  );
}
