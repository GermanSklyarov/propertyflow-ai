"use client";

import type { ComponentProps } from "react";
import { Trash2 } from "lucide-react";
import styles from "./listing-media-panel.module.css";

export function DeleteImageButton({ action }: { action: ComponentProps<"form">["action"] }) {
  return (
    <form
      action={action}
      className={styles.deleteImageForm}
      onSubmit={(event) => {
        if (!window.confirm("Delete this photo from the listing gallery?")) {
          event.preventDefault();
        }
      }}
    >
      <button aria-label="Delete photo" title="Delete photo" type="submit">
        <Trash2 size={15} />
      </button>
    </form>
  );
}
