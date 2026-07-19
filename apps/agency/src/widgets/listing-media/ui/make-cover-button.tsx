"use client";

import { ImageUp } from "lucide-react";
import styles from "./listing-media-panel.module.css";

export function MakeCoverButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action} className={styles.makeCoverForm}>
      <button aria-label="Make this photo the cover" title="Make cover" type="submit">
        <ImageUp size={15} />
        <span>Cover</span>
      </button>
    </form>
  );
}
