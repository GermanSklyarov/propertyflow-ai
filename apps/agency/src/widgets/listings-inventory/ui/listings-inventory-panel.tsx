import Link from "next/link";
import {
  Building2,
  CircleDollarSign,
  DraftingCompass,
  Gauge,
  Home,
  KeyRound,
  MapPin,
  Ruler,
  Sparkles,
  Waves
} from "lucide-react";
import {
  buildListingInventorySummary,
  buildListingQueueSignal,
  getListingGrossYield
} from "@entities/listing/lib/listing-inventory";
import {
  formatListingDistance,
  formatListingMoney,
  formatListingType
} from "@entities/listing/lib/listing-formatters";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket, formatPercent } from "@shared/lib/formatters";
import styles from "./listings-inventory-panel.module.css";

export function ListingsInventoryPanel({ listings }: { listings: PropertySnapshot[] }) {
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
        <KpiCard icon={<Sparkles size={18} />} label="AI ready" note="Enough rich fields" value={`${summary.aiReady}/${listings.length}`} />
      </section>

      <section className={styles.layout}>
        <aside className={styles.sidePanel}>
          <InventoryBreakdown title="Status" items={summary.byStatus} />
          <InventoryBreakdown title="Listing type" items={summary.byListingType} />
          <InventoryBreakdown title="Market" items={summary.byMarket} />
        </aside>

        <section className={styles.tablePanel} aria-label="Listings table">
          <div className={styles.tableHeader}>
            <div>
              <p className="section-kicker">Agent workspace</p>
              <h2 className={styles.panelTitle}>Inventory queue</h2>
            </div>
            <span className={styles.sortBadge}>Sorted by newest</span>
          </div>

          <div className={styles.list}>
            {listings.map((listing) => (
              <ListingRow key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      </section>
    </>
  );
}

function ListingRow({ listing }: { listing: PropertySnapshot }) {
  const readiness = buildListingQueueSignal(listing);
  const yieldSignal = getListingGrossYield(listing);

  return (
    <Link className={styles.listingRow} href={`/listings/${listing.id}`}>
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
