"use client";

import type { ComponentProps } from "react";
import { RotateCcw } from "lucide-react";
import styles from "./listing-media-panel.module.css";

export function RestoreImageButton({ action }: { action: ComponentProps<"form">["action"] }) {
  return (
    <form action={action} className={styles.restoreImageForm}>
      <button aria-label="Restore photo" title="Restore photo" type="submit">
        <RotateCcw size={15} />
        Restore
      </button>
    </form>
  );
}
