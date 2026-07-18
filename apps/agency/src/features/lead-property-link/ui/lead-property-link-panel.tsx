import { ChevronLeft, ChevronRight, Home, Link2, MapPin, Save, Search, SlidersHorizontal } from "lucide-react";
import { linkLeadPropertyAction } from "@entities/lead/api/lead-actions";
import {
  buildLeadPropertyCandidateHref,
  formatLeadPropertyCandidateSort,
  getLeadPropertyCandidatePage,
  leadPropertyCandidatePageSize,
  leadPropertyCandidateSortOptions
} from "@features/lead-property-link/model/lead-property-link";
import type { PropertySearchResponse } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket } from "@shared/lib/formatters";
import styles from "./lead-property-link-panel.module.css";

export function LeadPropertyLinkPanel({
  leadId,
  response
}: {
  leadId: string;
  response: PropertySearchResponse;
}) {
  const action = linkLeadPropertyAction.bind(null, leadId);
  const listings = response.items;
  const filters = response.filters;
  const currentPage = getLeadPropertyCandidatePage(filters);
  const pageSize = filters.limit ?? leadPropertyCandidatePageSize;
  const pageCount = Math.max(1, Math.ceil(response.total / pageSize));
  const firstVisible = response.total === 0 ? 0 : (filters.offset ?? 0) + 1;
  const lastVisible = Math.min(response.total, (filters.offset ?? 0) + listings.length);

  return (
    <section className={styles.panel} id="link-listing" aria-label="Link lead to listing">
      <div className={styles.header}>
        <div>
          <p className="section-kicker">Missing context</p>
          <h2>Link this lead to a listing</h2>
        </div>
        <Link2 size={20} />
      </div>

      <form action={`/leads/${leadId}#link-listing`} className={styles.searchForm} method="get">
        <label className={styles.searchField}>
          <Search size={17} />
          <input
            defaultValue={filters.query ?? ""}
            name="listingSearch"
            placeholder="condo jomtien 1 bedroom under 20k/month"
            type="search"
          />
        </label>
        <label className={styles.sortField}>
          <SlidersHorizontal size={16} />
          <select defaultValue={filters.sort ?? "created-desc"} name="listingSort">
            {leadPropertyCandidateSortOptions.map((sort) => (
              <option key={sort} value={sort}>
                {formatLeadPropertyCandidateSort(sort)}
              </option>
            ))}
          </select>
        </label>
        <span className={styles.resultMeta}>
          {firstVisible}-{lastVisible} of {response.total}
        </span>
        <button className={styles.searchButton} type="submit">
          Search listings
        </button>
      </form>

      <form action={action} className={styles.form}>
        <div className={styles.candidateGroup}>
          <span className={styles.fieldLabel}>{filters.query ? "Matching listings" : "Recent listings"}</span>
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

        {pageCount > 1 ? (
          <div className={styles.pagination} aria-label="Candidate listing pagination">
            <a
              aria-disabled={currentPage === 1}
              className={currentPage === 1 ? styles.paginationDisabled : ""}
              href={buildLeadPropertyCandidateHref(leadId, filters, { page: Math.max(1, currentPage - 1) })}
            >
              <ChevronLeft size={16} />
              Prev
            </a>
            <span>
              Page {currentPage} of {pageCount} · {formatLeadPropertyCandidateSort(filters.sort ?? "created-desc")}
            </span>
            <a
              aria-disabled={currentPage === pageCount}
              className={currentPage === pageCount ? styles.paginationDisabled : ""}
              href={buildLeadPropertyCandidateHref(leadId, filters, { page: Math.min(pageCount, currentPage + 1) })}
            >
              Next
              <ChevronRight size={16} />
            </a>
          </div>
        ) : null}

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
