import {
  Building2,
  CircleDollarSign,
  Gauge,
  Home,
  KeyRound,
  MapPin,
  Ruler,
  Sparkles,
  Waves
} from "lucide-react";
import { buildListingEconomics } from "@entities/listing/lib/listing-economics";
import {
  formatCompactListingMoney,
  formatListingDistance,
  formatListingType
} from "@entities/listing/lib/listing-formatters";
import type { buildListingReadiness } from "@entities/listing/lib/listing-readiness";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket } from "@shared/lib/formatters";
import styles from "./listing-overview-panel.module.css";

type ListingReadiness = ReturnType<typeof buildListingReadiness>;

export function ListingOverviewPanel({
  listing,
  readiness
}: {
  listing: PropertySnapshot;
  readiness: ListingReadiness;
}) {
  const economics = buildListingEconomics(listing);

  return (
    <>
      <section className={styles.kpiGrid} aria-label="Listing detail overview">
        <KpiCard
          icon={<CircleDollarSign size={18} />}
          label="Ask"
          note={formatListingType(listing.listingType)}
          value={formatCompactListingMoney(listing.price)}
        />
        <KpiCard icon={<KeyRound size={18} />} label="Rent signal" note={economics.rentNote} value={economics.rentValue} />
        <KpiCard icon={<Gauge size={18} />} label="Gross yield" note="Annual rent / ask" value={economics.grossYieldValue} />
        <KpiCard icon={<Sparkles size={18} />} label="AI readiness" note={readiness.note} value={`${readiness.score}/5`} />
      </section>

      <section className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Profile</p>
              <h2 className={styles.panelTitle}>Property facts</h2>
            </div>
            <Home size={20} />
          </div>
          <div className={styles.fieldGrid}>
            <Field icon={<Building2 size={15} />} label="Kind" value={formatBucket(listing.kind)} />
            <Field icon={<MapPin size={15} />} label="Market" value={formatBucket(listing.market)} />
            <Field icon={<Ruler size={15} />} label="Area" value={`${listing.areaSqm} sqm`} />
            <Field label="Bedrooms" value={`${listing.bedrooms}`} />
            <Field label="Bathrooms" value={`${listing.bathrooms}`} />
            <Field label="Floor" value={listing.floor ? `${listing.floor}` : "not set"} />
            <Field
              icon={<Waves size={15} />}
              label="Beach"
              value={listing.beachDistanceMeters ? formatListingDistance(listing.beachDistanceMeters) : "not set"}
            />
            <Field label="Address" value={listing.address ?? "not provided"} wide />
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Economics</p>
              <h2 className={styles.panelTitle}>Ownership and rent</h2>
            </div>
            <CircleDollarSign size={20} />
          </div>
          <div className={styles.economicsGrid}>
            <Metric label="Price per sqm" value={economics.pricePerSqm} />
            <Metric label="Monthly maintenance" value={economics.maintenanceValue} />
            <Metric label="Annual gross rent" value={economics.annualRentValue} />
            <Metric label="Yield quality" value={economics.yieldQuality} />
          </div>
        </section>
      </section>
    </>
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

function Field({
  icon,
  label,
  value,
  wide = false
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`${styles.field} ${wide ? styles.fieldWide : ""}`}>
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
