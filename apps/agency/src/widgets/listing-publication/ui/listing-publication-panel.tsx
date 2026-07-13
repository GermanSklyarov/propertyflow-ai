import { ExternalLink } from "lucide-react";
import type { buildListingPublicationSummary } from "@entities/listing/lib/listing-readiness";
import styles from "./listing-publication-panel.module.css";

type ListingPublicationSummary = ReturnType<typeof buildListingPublicationSummary>;

export function ListingPublicationPanel({ publication }: { publication: ListingPublicationSummary }) {
  return (
    <section className={styles.publicationPanel} aria-label="Client publication sync">
      <div className={styles.publicationHeader}>
        <div>
          <p className="section-kicker">Client publication</p>
          <h2 className={styles.panelTitle}>{publication.title}</h2>
        </div>
        <a className={styles.previewLink} href={publication.previewHref} target="_blank" rel="noreferrer">
          Preview public page
          <ExternalLink size={15} />
        </a>
      </div>
      <div className={styles.publicationGrid}>
        {publication.items.map((item) => (
          <article className={`${styles.publicationItem} ${item.ready ? styles.publicationReady : styles.publicationBlocked}`} key={item.label}>
            <span>{item.ready ? "Ready" : "Missing"}</span>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
