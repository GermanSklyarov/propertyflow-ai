import {
  BadgeCheck,
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
import type { PropertySnapshot } from "@propertyflow/domain";
import styles from "./listings-page.module.css";

export function ListingsPage({ listings, total }: { listings: PropertySnapshot[]; total: number }) {
  const summary = buildListingSummary(listings);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="section-kicker">Inventory operations</p>
            <h1 className={styles.title}>Listings control room</h1>
            <p className={styles.subtitle}>
              Track sale and rental supply, publication status, AI readiness, rent economics, and missing listing signals.
            </p>
          </div>
          <span className={styles.totalBadge}>{total} listings</span>
        </header>

        <section className={styles.kpiGrid} aria-label="Listing inventory overview">
          <KpiCard icon={<Building2 size={18} />} label="Available" note="Ready for clients" value={summary.available} />
          <KpiCard icon={<KeyRound size={18} />} label="Rental ready" note="Has monthly rent" value={summary.rentalReady} />
          <KpiCard icon={<CircleDollarSign size={18} />} label="Avg yield" note="Estimate signal" value={formatPercent(summary.averageYield)} />
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
              <span className={styles.totalBadge}>Sorted by newest</span>
            </div>

            <div className={styles.list}>
              {listings.map((listing) => (
                <ListingRow key={listing.id} listing={listing} />
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function ListingRow({ listing }: { listing: PropertySnapshot }) {
  const readiness = getReadiness(listing);
  const yieldSignal = getGrossYield(listing);

  return (
    <article className={styles.listingRow}>
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
              {formatDistance(listing.beachDistanceMeters)}
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.commercials}>
        <span className={`${styles.statusPill} ${styles[`status-${listing.status}`]}`}>{formatBucket(listing.status)}</span>
        <strong>{formatMoney(listing.price)}</strong>
        <small>{formatListingType(listing.listingType)}</small>
        {listing.rentalPriceMonthly ? <small>{formatMoney(listing.rentalPriceMonthly)}/mo</small> : null}
      </div>

      <div className={styles.signals}>
        <SignalPill icon={<Gauge size={14} />} label={yieldSignal ? `${formatPercent(yieldSignal)} yield` : "yield gap"} />
        <SignalPill icon={<Sparkles size={14} />} label={`${readiness.score}/5 AI ready`} tone={readiness.tone} />
        <SignalPill icon={<DraftingCompass size={14} />} label={readiness.nextAction} />
      </div>
    </article>
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

function buildListingSummary(listings: PropertySnapshot[]) {
  const yields = listings.map(getGrossYield).filter((value): value is number => value !== undefined);

  return {
    aiReady: listings.filter((listing) => getReadiness(listing).score >= 4).length,
    available: listings.filter((listing) => listing.status === "available").length,
    averageYield: yields.reduce((sum, value) => sum + value, 0) / Math.max(1, yields.length),
    byListingType: countBy(listings, (listing) => listing.listingType),
    byMarket: countBy(listings, (listing) => listing.market),
    byStatus: countBy(listings, (listing) => listing.status),
    rentalReady: listings.filter((listing) => listing.rentalPriceMonthly).length
  };
}

function getReadiness(listing: PropertySnapshot) {
  const checks = [
    Boolean(listing.description),
    listing.amenities.length >= 4,
    Boolean(listing.beachDistanceMeters),
    Boolean(listing.monthlyRentEstimate || listing.rentalPriceMonthly),
    Boolean(listing.maintenanceFeeMonthly)
  ];
  const score = checks.filter(Boolean).length;

  if (score >= 4) {
    return { nextAction: "publish-ready", score, tone: "good" as const };
  }

  if (!listing.description) {
    return { nextAction: "generate copy", score, tone: "warning" as const };
  }

  if (listing.amenities.length < 4) {
    return { nextAction: "add amenities", score, tone: "warning" as const };
  }

  return { nextAction: "enrich economics", score, tone: "neutral" as const };
}

function getGrossYield(listing: PropertySnapshot) {
  const rent = listing.monthlyRentEstimate ?? listing.rentalPriceMonthly;

  if (!rent || listing.price.amount <= 0) {
    return undefined;
  }

  return (rent.amount * 12) / listing.price.amount;
}

function countBy<T>(items: T[], getLabel: (item: T) => string) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const label = getLabel(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

function formatBucket(value: string) {
  return value.replaceAll("-", " ").replaceAll("_", " ");
}

function formatDistance(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value} m`;
}

function formatListingType(value: PropertySnapshot["listingType"]) {
  const labels = {
    rent: "For rent",
    sale: "For sale",
    sale_or_rent: "Sale or rent"
  } satisfies Record<PropertySnapshot["listingType"], string>;

  return labels[value];
}

function formatMoney(value: PropertySnapshot["price"]) {
  return new Intl.NumberFormat("en", {
    currency: value.currency,
    maximumFractionDigits: 0,
    notation: value.amount >= 1_000_000 ? "compact" : "standard",
    style: "currency"
  }).format(value.amount);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
