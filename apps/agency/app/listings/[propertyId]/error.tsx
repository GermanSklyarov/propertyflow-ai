"use client";

import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import styles from "../../not-found.module.css";

export default function ListingDetailError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="listing-error-title">
        <p className="section-kicker">Listing link unavailable</p>
        <div className={styles.hero}>
          <strong>Link</strong>
          <h1 id="listing-error-title">Could not open this listing route.</h1>
          <p>{error.message || "The widget listing route may point to a page that is not available in this workspace."}</p>
        </div>

        <div className={styles.actions} aria-label="Listing recovery routes">
          <button className={styles.primaryLink} onClick={reset} type="button">
            <RotateCcw size={17} />
            Try again
          </button>
          <Link className={styles.secondaryLink} href="/widget-demo">
            <ArrowLeft size={17} />
            Back to widget demo
          </Link>
          <Link className={styles.secondaryLink} href="/settings#widget-origin-settings">
            Widget route settings
          </Link>
        </div>
      </section>
    </main>
  );
}
