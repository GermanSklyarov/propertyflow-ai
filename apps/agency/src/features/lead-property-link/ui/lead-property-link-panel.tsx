import { Home, Link2, MapPin, Save, Search } from "lucide-react";
import { linkLeadPropertyAction } from "@entities/lead/api/lead-actions";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket } from "@shared/lib/formatters";
import styles from "./lead-property-link-panel.module.css";

export function LeadPropertyLinkPanel({
  leadId,
  listings,
  searchQuery
}: {
  leadId: string;
  listings: PropertySnapshot[];
  searchQuery: string;
}) {
  const action = linkLeadPropertyAction.bind(null, leadId);

  return (
    <section className={styles.panel} aria-label="Link lead to listing">
      <div className={styles.header}>
        <div>
          <p className="section-kicker">Missing context</p>
          <h2>Link this lead to a listing</h2>
        </div>
        <Link2 size={20} />
      </div>

      <form className={styles.searchForm} method="get">
        <label className={styles.searchField}>
          <Search size={17} />
          <input
            defaultValue={searchQuery}
            name="listingSearch"
            placeholder="condo jomtien 1 bedroom under 20k/month"
            type="search"
          />
        </label>
        <button className={styles.searchButton} type="submit">
          Search listings
        </button>
      </form>

      <form action={action} className={styles.form}>
        <div className={styles.candidateGroup}>
          <span className={styles.fieldLabel}>{searchQuery ? "Matching listings" : "Recent listings"}</span>
          <div className={styles.candidateList}>
            {listings.map((listing) => (
              <label className={styles.candidateCard} key={listing.id}>
                <input name="propertyId" required type="radio" value={listing.id} />
                <span className={styles.candidateBody}>
                  <strong>{listing.title}</strong>
                  <small>
                    <MapPin size={13} />
                    {listing.address ?? listing.market}
                  </small>
                  <span className={styles.candidateMeta}>
                    <span>
                      <Home size={13} />
                      {formatBucket(listing.listingType)}
                    </span>
                    <span>{formatBucket(listing.status)}</span>
                    <span>{listing.areaSqm} sqm</span>
                    <span>
                      {listing.bedrooms} bd · {listing.bathrooms} ba
                    </span>
                  </span>
                </span>
              </label>
            ))}
            {listings.length === 0 ? (
              <div className={styles.emptyState}>
                No listings match this search. Try a market, project, bedroom count, or budget phrase.
              </div>
            ) : null}
          </div>
        </div>

        <label>
          <span>Agent note</span>
          <input name="note" placeholder="Why this listing matches the lead" />
        </label>

        <button disabled={listings.length === 0} type="submit">
          <Save size={16} />
          Link listing
        </button>
      </form>
    </section>
  );
}
