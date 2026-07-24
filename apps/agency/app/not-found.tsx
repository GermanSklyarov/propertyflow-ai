import Link from "next/link";
import { ArrowLeft, BookOpenText, Building2, LayoutDashboard } from "lucide-react";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="not-found-title">
        <p className="section-kicker">404</p>
        <div className={styles.hero}>
          <strong>Page not found</strong>
          <h1 id="not-found-title">This workspace route is not available.</h1>
          <p>
            The page may have moved, or the link points to a setup step that has not been added to the Agency OS navigation yet.
          </p>
        </div>

        <div className={styles.actions} aria-label="Helpful routes">
          <Link className={styles.primaryLink} href="/settings">
            <ArrowLeft size={17} />
            Back to settings
          </Link>
          <Link className={styles.secondaryLink} href="/knowledge">
            <BookOpenText size={17} />
            Knowledge
          </Link>
          <Link className={styles.secondaryLink} href="/listings">
            <Building2 size={17} />
            Listings
          </Link>
          <Link className={styles.secondaryLink} href="/">
            <LayoutDashboard size={17} />
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
