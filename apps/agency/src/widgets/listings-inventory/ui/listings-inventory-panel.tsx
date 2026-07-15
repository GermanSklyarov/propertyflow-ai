import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  DraftingCompass,
  Gauge,
  Home,
  KeyRound,
  MapPin,
  Ruler,
  Search,
  SlidersHorizontal,
  Sparkles,
  Waves
} from "lucide-react";
import {
  buildListingInventorySummary,
  buildListingQueueSignal,
  getListingGrossYield
} from "@entities/listing/lib/listing-inventory";
import { buildListingCoverImageSrc } from "@entities/listing/lib/listing-media";
import {
  formatListingDistance,
  formatListingMoney,
  formatListingType,
  formatProjectStatus
} from "@entities/listing/lib/listing-formatters";
import type { PropertySearchRequest, PropertySearchResponse, PropertySearchSort } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket, formatPercent } from "@shared/lib/formatters";
import styles from "./listings-inventory-panel.module.css";

const sortLabels: Record<PropertySearchSort, string> = {
  "ai-fit": "AI fit",
  "beach-asc": "Beach distance",
  "created-desc": "Newest first",
  "price-asc": "Price low to high",
  "price-desc": "Price high to low",
  "rent-asc": "Rent low to high",
  "yield-desc": "Yield strongest"
};

export function ListingsInventoryPanel({ error, response }: { error?: string; response?: PropertySearchResponse }) {
  if (!response) {
    return <InventoryLoadError message={error ?? "Backend is unavailable. Start the API server and retry."} />;
  }

  const listings = response.items;
  const filters = response.filters;
  const pageSize = filters.limit ?? (listings.length || 1);
  const currentPage = Math.floor((filters.offset ?? 0) / pageSize) + 1;
  const pageCount = Math.max(1, Math.ceil(response.total / pageSize));
  const firstVisible = listings.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastVisible = Math.min((currentPage - 1) * pageSize + listings.length, response.total);
  const summary = buildListingInventorySummary(listings);

  return (
    <>
      <section className={styles.kpiGrid} aria-label="Listing inventory overview">
        <KpiCard icon={<Building2 size={18} />} label="Available" note="Ready for clients" value={summary.available} />
        <KpiCard icon={<KeyRound size={18} />} label="Rental ready" note="Has monthly rent" value={summary.rentalReady} />
        <KpiCard
          icon={<CircleDollarSign size={18} />}
          label="Avg yield"
          note="Estimate signal"
          value={formatPercent(summary.averageYield, { maximumFractionDigits: 1 })}
        />
        <KpiCard icon={<Sparkles size={18} />} label="AI ready" note="Visible page" value={`${summary.aiReady}/${listings.length}`} />
        <KpiCard icon={<AlertTriangle size={18} />} label="Missing project" note="Cleanup queue" value={summary.missingProject} />
      </section>

      <section className={styles.layout}>
        <aside className={styles.sidePanel}>
          <InventoryBreakdown title="Status" items={summary.byStatus} />
          <InventoryBreakdown title="Listing type" items={summary.byListingType} />
          <InventoryBreakdown title="Market" items={summary.byMarket} />
          <InventoryBreakdown title="Project link" items={summary.byProjectLink} />
        </aside>

        <section className={styles.tablePanel} id="inventory" aria-label="Listings table">
          <div className={styles.tableHeader}>
            <div>
              <p className="section-kicker">Agent workspace</p>
              <h2 className={styles.panelTitle}>Inventory queue</h2>
            </div>
            <div className={styles.tableActions}>
              <div className={styles.filterToggle} aria-label="Inventory filter">
                <Link
                  className={filters.projectLink !== "missing" ? styles.filterActive : ""}
                  href={inventoryHref(filters, { page: 1, projectLink: "all" })}
                >
                  All
                  <span>{response.total}</span>
                </Link>
                <Link
                  className={filters.projectLink === "missing" ? styles.filterActive : ""}
                  href={inventoryHref(filters, { page: 1, projectLink: "missing" })}
                >
                  Missing project
                  <span>{filters.projectLink === "missing" ? response.total : summary.missingProject}</span>
                </Link>
              </div>
            </div>
          </div>

          <form action="/listings#inventory" className={styles.inventoryToolbar} method="get">
            <label className={styles.searchBox}>
              <Search size={17} />
              <input
                defaultValue={filters.query ?? ""}
                name="query"
                placeholder="condo jomtien 1 bedroom under 20k/month"
                type="search"
              />
            </label>
            <label className={styles.sortControl}>
              <SlidersHorizontal size={16} />
              <select defaultValue={filters.sort ?? "created-desc"} name="sort">
                <option value="created-desc">Newest first</option>
                <option value="price-asc">Price low to high</option>
                <option value="price-desc">Price high to low</option>
                <option value="rent-asc">Rent low to high</option>
                <option value="yield-desc">Yield strongest</option>
              </select>
            </label>
            <input name="projectLink" type="hidden" value={filters.projectLink ?? "all"} />
            <span className={styles.resultMeta}>
              {firstVisible}-{lastVisible} of {response.total}
            </span>
            <button className={styles.applyButton} type="submit">
              Apply
            </button>
          </form>

          <div className={styles.list}>
            {listings.map((listing) => (
              <ListingRow key={listing.id} listing={listing} />
            ))}
            {listings.length === 0 ? (
              <div className={styles.emptyState}>
                <Building2 size={18} />
                <span>No listings match this inventory search.</span>
              </div>
            ) : null}
          </div>

          {pageCount > 1 ? (
            <div className={styles.pagination} aria-label="Listing pagination">
              <Link
                aria-disabled={currentPage === 1}
                className={currentPage === 1 ? styles.paginationDisabled : ""}
                href={inventoryHref(filters, { page: Math.max(1, currentPage - 1) })}
              >
                <ChevronLeft size={16} />
                Prev
              </Link>
              <span>
                Page {currentPage} of {pageCount} · {sortLabels[filters.sort ?? "created-desc"]}
              </span>
              <Link
                aria-disabled={currentPage === pageCount}
                className={currentPage === pageCount ? styles.paginationDisabled : ""}
                href={inventoryHref(filters, { page: Math.min(pageCount, currentPage + 1) })}
              >
                Next
                <ChevronRight size={16} />
              </Link>
            </div>
          ) : null}
        </section>
      </section>
    </>
  );
}

function InventoryLoadError({ message }: { message: string }) {
  return (
    <section className={styles.tablePanel} id="inventory" aria-label="Listings loading error">
      <div className={styles.errorState}>
        <AlertTriangle size={20} />
        <div>
          <p className="section-kicker">Inventory unavailable</p>
          <h2>Could not load listings</h2>
          <span>{message}</span>
        </div>
      </div>
    </section>
  );
}

function inventoryHref(filters: PropertySearchRequest, patch: Partial<PropertySearchRequest> & { page?: number }) {
  const nextFilters = {
    projectLink: filters.projectLink,
    query: filters.query,
    sort: filters.sort,
    ...patch
  };
  const params = new URLSearchParams();

  if (nextFilters.query) {
    params.set("query", nextFilters.query);
  }

  if (nextFilters.sort && nextFilters.sort !== "created-desc") {
    params.set("sort", nextFilters.sort);
  }

  if (nextFilters.projectLink && nextFilters.projectLink !== "all") {
    params.set("projectLink", nextFilters.projectLink);
  }

  if (nextFilters.page && nextFilters.page > 1) {
    params.set("page", String(nextFilters.page));
  }

  const query = params.toString();

  return query ? `/listings?${query}#inventory` : "/listings#inventory";
}

function ListingRow({ listing }: { listing: PropertySnapshot }) {
  const readiness = buildListingQueueSignal(listing);
  const yieldSignal = getListingGrossYield(listing);

  return (
    <Link className={styles.listingRow} href={`/listings/${listing.id}`}>
      <div className={styles.mediaFrame}>
        <img alt={`${listing.title} cover`} src={buildListingCoverImageSrc(listing)} />
        <span>{formatListingType(listing.listingType)}</span>
      </div>

      <div className={styles.rowBody}>
        <div className={styles.listingMain}>
          <div className={styles.titleRow}>
            <span className={styles.kindIcon}>
              <Home size={17} />
            </span>
            <div>
              <h3 className={styles.listingTitle}>{listing.title}</h3>
              <p className={styles.address}>
                <MapPin size={14} />
                {listing.address ?? listing.market}
              </p>
            </div>
          </div>

          <p className={styles.description}>{listing.description ?? "No description yet. Run AI assistant before publishing."}</p>

          <div className={styles.metaRow}>
            <span>
              <Ruler size={14} />
              {listing.areaSqm} sqm
            </span>
            <span>{listing.bedrooms} bd</span>
            <span>{listing.bathrooms} ba</span>
            {listing.beachDistanceMeters ? (
              <span>
                <Waves size={14} />
                {formatListingDistance(listing.beachDistanceMeters)}
              </span>
            ) : null}
            {listing.project ? (
              <span>
                <Building2 size={14} />
                {listing.project.name} · {formatProjectStatus(listing.project.status)}
              </span>
            ) : (
              <span className={styles.missingProjectPill}>
                <AlertTriangle size={14} />
                Missing project
              </span>
            )}
          </div>
        </div>

        <div className={styles.commercials}>
          <span className={`${styles.statusPill} ${styles[`status-${listing.status}`]}`}>{formatBucket(listing.status)}</span>
          <strong>{formatListingMoney(listing.price)}</strong>
          <small>{formatListingType(listing.listingType)}</small>
          {listing.rentalPriceMonthly ? <small>{formatListingMoney(listing.rentalPriceMonthly)}/mo</small> : null}
        </div>

        <div className={styles.signals}>
          <SignalPill
            icon={<Gauge size={14} />}
            label={yieldSignal ? `${formatPercent(yieldSignal, { maximumFractionDigits: 1 })} yield` : "yield gap"}
          />
          <SignalPill icon={<Sparkles size={14} />} label={`${readiness.score}/5 AI ready`} tone={readiness.tone} />
          <SignalPill icon={<DraftingCompass size={14} />} label={readiness.nextAction} />
        </div>
      </div>
    </Link>
  );
}

function KpiCard({
  icon,
  label,
  note,
  value
}: {
  icon: React.ReactNode;
  label: string;
  note: string;
  value: number | string;
}) {
  return (
    <article className={styles.kpiCard}>
      <div className={styles.kpiIcon}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function InventoryBreakdown({ items, title }: { items: Array<{ label: string; count: number }>; title: string }) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <section className={styles.breakdown}>
      <p className="section-kicker">{title}</p>
      <div className={styles.breakdownList}>
        {items.map((item) => (
          <div className={styles.breakdownRow} key={item.label}>
            <span>{formatBucket(item.label)}</span>
            <strong>{item.count}</strong>
            <div className={styles.breakdownTrack}>
              <span style={{ width: `${Math.max(10, (item.count / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SignalPill({
  icon,
  label,
  tone = "neutral"
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "good" | "neutral" | "warning";
}) {
  return (
    <span className={`${styles.signalPill} ${styles[tone]}`}>
      {icon}
      {label}
    </span>
  );
}
