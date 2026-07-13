import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  Home,
  KeyRound,
  MapPin,
  Ruler,
  Sparkles,
  Waves
} from "lucide-react";
import {
  formatCompactListingMoney,
  formatListingDistance,
  formatListingMoney,
  formatListingType
} from "@entities/listing/lib/listing-formatters";
import { buildListingMediaSummary } from "@entities/listing/lib/listing-media";
import {
  buildListingNextActions,
  buildListingPublicationSummary,
  buildListingReadiness
} from "@entities/listing/lib/listing-readiness";
import { ListingAiDescriptionReviewPanel } from "@features/listing-ai-description-review/ui/listing-ai-description-review-panel";
import { ListingImageAnalysisReviewPanel } from "@features/listing-image-analysis-review/ui/listing-image-analysis-review-panel";
import type { PropertyAiAssets, PropertyImageGalleryResponse } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket, formatPercent } from "@shared/lib/formatters";
import { ListingAgentGuidancePanel } from "@widgets/listing-agent-guidance/ui/listing-agent-guidance-panel";
import { ListingMediaPanel } from "@widgets/listing-media/ui/listing-media-panel";
import { ListingPublicationPanel } from "@widgets/listing-publication/ui/listing-publication-panel";
import styles from "./listing-detail-page.module.css";

export function ListingDetailPage({
  appliedDescriptionAssetId,
  appliedImageAnalysisAssetId,
  aiAssets,
  gallery,
  listing,
  queuedImageAnalysis = false
}: {
  appliedDescriptionAssetId?: string;
  appliedImageAnalysisAssetId?: string;
  aiAssets: PropertyAiAssets;
  gallery: PropertyImageGalleryResponse;
  listing: PropertySnapshot;
  queuedImageAnalysis?: boolean;
}) {
  const economics = buildEconomics(listing);
  const media = buildListingMediaSummary(gallery);
  const publication = buildListingPublicationSummary(listing, media.activeCount);
  const readiness = buildListingReadiness(listing);
  const nextActions = buildListingNextActions(listing, readiness.score);

  return (
    <main className={styles.page} id="listing-brief">
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/listings">
              <ArrowLeft size={16} />
              Back to listings
            </Link>
            <p className="section-kicker">Listing workspace</p>
            <h1 className={styles.title}>{listing.title}</h1>
            <p className={styles.subtitle}>{listing.description ?? "No description yet. Run AI enrichment before publishing."}</p>
          </div>
          <span className={`${styles.statusBadge} ${styles[`status-${listing.status}`]}`}>{formatBucket(listing.status)}</span>
        </header>
        {appliedDescriptionAssetId ? (
          <div className={styles.descriptionAppliedNotice}>
            <CheckCircle2 size={18} />
            <div>
              <strong>AI description applied</strong>
              <p>The listing title and public description were updated from the approved generated copy.</p>
            </div>
          </div>
        ) : null}

        <ListingMediaPanel gallery={gallery} listingId={listing.id} listingTitle={listing.title} />

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

        <ListingPublicationPanel publication={publication} />

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

        <ListingAgentGuidancePanel nextActions={nextActions} readiness={readiness} />

        <ListingAiDescriptionReviewPanel
          appliedDescriptionAssetId={appliedDescriptionAssetId}
          descriptions={aiAssets.descriptions}
          propertyId={listing.id}
        />

        <ListingImageAnalysisReviewPanel
          activeImageCount={media.activeCount}
          appliedImageAnalysisAssetId={appliedImageAnalysisAssetId}
          gallery={gallery}
          imageAnalysis={aiAssets.imageAnalysis}
          propertyId={listing.id}
          queuedImageAnalysis={queuedImageAnalysis}
        />

        <section className={styles.panel} id="amenities">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Amenities</p>
              <h2 className={styles.panelTitle}>Client-facing tags</h2>
            </div>
            <Sparkles size={20} />
          </div>
          {appliedImageAnalysisAssetId ? (
            <div className={styles.amenitiesNotice}>
              <CheckCircle2 size={18} />
              <div>
                <strong>AI features applied</strong>
                <p>Client-facing tags were updated from the approved image analysis.</p>
              </div>
            </div>
          ) : null}
          <div className={styles.chipGrid}>
            {listing.amenities.length ? (
              listing.amenities.map((amenity) => <span key={amenity}>{formatBucket(amenity)}</span>)
            ) : (
              <span>Add amenities before publishing</span>
            )}
          </div>
        </section>
      </div>
    </main>
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

function buildEconomics(listing: PropertySnapshot) {
  const rent = listing.monthlyRentEstimate ?? listing.rentalPriceMonthly;
  const grossYield = rent && listing.price.amount > 0 ? (rent.amount * 12) / listing.price.amount : undefined;

  return {
    annualRentValue: rent ? formatListingMoney({ ...rent, amount: rent.amount * 12 }) : "not estimated",
    grossYieldValue: grossYield ? formatPercent(grossYield, { maximumFractionDigits: 1 }) : "not enough data",
    maintenanceValue: listing.maintenanceFeeMonthly ? `${formatListingMoney(listing.maintenanceFeeMonthly)}/mo` : "not set",
    pricePerSqm: listing.areaSqm > 0 ? formatListingMoney({ ...listing.price, amount: listing.price.amount / listing.areaSqm }) : "not set",
    rentNote: listing.rentalPriceMonthly ? "Listed monthly rent" : rent ? "AI rent estimate" : "Needs rent signal",
    rentValue: rent ? `${formatCompactListingMoney(rent)}/mo` : "not set",
    yieldQuality: grossYield ? getYieldQuality(grossYield) : "needs rent estimate"
  };
}

function getYieldQuality(grossYield: number) {
  if (grossYield >= 0.07) {
    return "strong investment signal";
  }

  if (grossYield >= 0.05) {
    return "market-normal signal";
  }

  return "lifestyle-led case";
}
