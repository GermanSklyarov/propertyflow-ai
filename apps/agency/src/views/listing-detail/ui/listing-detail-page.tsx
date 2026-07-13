import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  CircleDollarSign,
  DraftingCompass,
  ExternalLink,
  FileText,
  Gauge,
  Home,
  KeyRound,
  MapPin,
  Ruler,
  ScanSearch,
  Sparkles,
  Waves,
  X
} from "lucide-react";
import {
  applyPropertyImageAnalysisAction,
  applyPropertyDescriptionAction,
  reviewPropertyDescriptionAction,
  reviewPropertyImageAnalysisAction
} from "@entities/listing/api/listing-actions";
import { buildGalleryImageSrc, buildListingMediaSummary } from "@entities/listing/lib/listing-media";
import type {
  GeneratedPropertyDescription,
  PropertyAiAssets,
  PropertyImageAnalysisResult,
  PropertyImageGalleryResponse
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket, formatPercent } from "@shared/lib/formatters";
import { ListingMediaPanel } from "@widgets/listing-media/ui/listing-media-panel";
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
  const publication = buildPublicationSummary(listing, media);
  const readiness = getReadiness(listing);
  const nextActions = buildNextActions(listing, readiness.score);
  const imageAnalysisEmptyCopy = buildImageAnalysisEmptyCopy(media);
  const galleryImagesById = new Map(gallery.images.map((image) => [image.id, image]));

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
          <KpiCard icon={<CircleDollarSign size={18} />} label="Ask" note={formatListingType(listing.listingType)} value={formatCompactMoney(listing.price)} />
          <KpiCard icon={<KeyRound size={18} />} label="Rent signal" note={economics.rentNote} value={economics.rentValue} />
          <KpiCard icon={<Gauge size={18} />} label="Gross yield" note="Annual rent / ask" value={economics.grossYieldValue} />
          <KpiCard icon={<Sparkles size={18} />} label="AI readiness" note={readiness.note} value={`${readiness.score}/5`} />
        </section>

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
              <Field icon={<Waves size={15} />} label="Beach" value={listing.beachDistanceMeters ? formatDistance(listing.beachDistanceMeters) : "not set"} />
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

        <section className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className="section-kicker">AI readiness</p>
                <h2 className={styles.panelTitle}>Publication signals</h2>
              </div>
              <BadgeCheck size={20} />
            </div>
            <div className={styles.readinessList}>
              {readiness.checks.map((check) => (
                <article className={`${styles.readinessItem} ${check.done ? styles.done : styles.missing}`} key={check.label}>
                  <span>{check.done ? "Ready" : "Missing"}</span>
                  <strong>{check.label}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className="section-kicker">Agent actions</p>
                <h2 className={styles.panelTitle}>Next best steps</h2>
              </div>
              <DraftingCompass size={20} />
            </div>
            <div className={styles.actionList}>
              {nextActions.map((action) => (
                <article className={styles.actionItem} key={action.title}>
                  <strong>{action.title}</strong>
                  <p>{action.body}</p>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className={styles.panel} id="ai-descriptions">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">AI descriptions</p>
              <h2 className={styles.panelTitle}>{buildDescriptionAssetTitle(aiAssets.descriptions)}</h2>
            </div>
            <FileText size={20} />
          </div>
          {aiAssets.descriptions.length ? (
            <div className={styles.descriptionGrid}>
              {aiAssets.descriptions.map((asset) => (
                <article className={styles.descriptionCard} key={asset.id}>
                  <div className={styles.descriptionMeta}>
                    <span className={`${styles.analysisStatus} ${styles[`analysis-${asset.reviewStatus}`]}`}>
                      {formatBucket(asset.reviewStatus)}
                    </span>
                    <span>{asset.locale.toUpperCase()}</span>
                  </div>
                  <h3>{asset.title}</h3>
                  <p>{asset.description}</p>
                  <div className={styles.analysisActions}>
                    <form action={reviewPropertyDescriptionAction.bind(null, listing.id, asset.id, "approved")}>
                      <button className={`${styles.analysisActionButton} ${styles.approveButton}`} type="submit">
                        <Check size={14} />
                        <span>Approve</span>
                      </button>
                    </form>
                    <form action={reviewPropertyDescriptionAction.bind(null, listing.id, asset.id, "rejected")}>
                      <button className={`${styles.analysisActionButton} ${styles.rejectButton}`} type="submit">
                        <X size={14} />
                        <span>Reject</span>
                      </button>
                    </form>
                    <form action={applyPropertyDescriptionAction.bind(null, listing.id, asset.id)}>
                      <button
                        className={`${styles.analysisActionButton} ${
                          appliedDescriptionAssetId === asset.id ? styles.appliedButton : ""
                        }`}
                        disabled={asset.reviewStatus !== "approved"}
                        type="submit"
                      >
                        {appliedDescriptionAssetId === asset.id ? (
                          <>
                            <CheckCircle2 size={14} />
                            <span>Applied</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>Apply copy</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyAnalysis}>
              <Sparkles size={24} />
              <strong>No generated descriptions yet</strong>
              <p>Run the listing assistant from AI Tools. Generated copy will appear here for human review before publishing.</p>
            </div>
          )}
        </section>

        <section className={styles.panel} id="ai-image-analysis">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">AI image analysis</p>
              <h2 className={styles.panelTitle}>{buildImageAnalysisTitle(aiAssets.imageAnalysis, media.activeCount)}</h2>
            </div>
            <ScanSearch size={20} />
          </div>
          {queuedImageAnalysis ? (
            <div className={styles.analysisNotice}>
              <Sparkles size={18} />
              <div>
                <strong>Photo added to the analysis queue</strong>
                <p>The gallery has the uploaded image now. Keep the worker running and review the AI result here once it finishes.</p>
              </div>
            </div>
          ) : null}
          {aiAssets.imageAnalysis.length ? (
            <div className={styles.analysisGrid}>
              {aiAssets.imageAnalysis.map((asset) => {
                const linkedImage = asset.propertyImageId ? galleryImagesById.get(asset.propertyImageId) : undefined;
                const imageSrc = linkedImage ? buildGalleryImageSrc(linkedImage) : asset.imageUrl;

                return (
                  <article className={styles.analysisCard} key={asset.id}>
                    <img src={imageSrc} alt={linkedImage?.caption ?? "AI analyzed listing photo"} />
                    <div>
                      <span className={`${styles.analysisStatus} ${styles[`analysis-${asset.reviewStatus}`]}`}>
                        {formatBucket(asset.reviewStatus)}
                      </span>
                      <strong>{formatPercent(asset.confidence, { maximumFractionDigits: 0 })} confidence</strong>
                      <div className={styles.analysisFeatures}>
                        {asset.detectedFeatures.length ? (
                          asset.detectedFeatures.map((feature) => <span key={feature}>{formatBucket(feature)}</span>)
                        ) : (
                          <span>No features detected</span>
                        )}
                      </div>
                      <div className={styles.analysisActions}>
                        <form action={reviewPropertyImageAnalysisAction.bind(null, listing.id, asset.id, "approved")}>
                          <button className={`${styles.analysisActionButton} ${styles.approveButton}`} type="submit">
                            <Check size={14} />
                            <span>Approve</span>
                          </button>
                        </form>
                        <form action={reviewPropertyImageAnalysisAction.bind(null, listing.id, asset.id, "rejected")}>
                          <button className={`${styles.analysisActionButton} ${styles.rejectButton}`} type="submit">
                            <X size={14} />
                            <span>Reject</span>
                          </button>
                        </form>
                        <form action={applyPropertyImageAnalysisAction.bind(null, listing.id, asset.id)}>
                          <button
                            className={`${styles.analysisActionButton} ${
                              appliedImageAnalysisAssetId === asset.id ? styles.appliedButton : ""
                            }`}
                            disabled={asset.reviewStatus !== "approved"}
                            type="submit"
                          >
                            {appliedImageAnalysisAssetId === asset.id ? (
                              <>
                                <CheckCircle2 size={14} />
                                <span>Applied</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={14} />
                                <span>Apply features</span>
                              </>
                            )}
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyAnalysis}>
              <ScanSearch size={24} />
              <strong>{imageAnalysisEmptyCopy.title}</strong>
              <p>{imageAnalysisEmptyCopy.body}</p>
            </div>
          )}
        </section>

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

function buildImageAnalysisTitle(items: PropertyImageAnalysisResult[], activeImageCount: number) {
  if (!items.length) {
    if (activeImageCount) {
      return `Analysis queued for ${activeImageCount} photos`;
    }

    return "Waiting for analyzed photos";
  }

  const approved = items.filter((item) => item.reviewStatus === "approved").length;
  const draft = items.filter((item) => item.reviewStatus === "draft").length;

  return `${items.length} analyzed photos, ${draft} awaiting review, ${approved} approved`;
}

function buildDescriptionAssetTitle(items: GeneratedPropertyDescription[]) {
  if (!items.length) {
    return "Waiting for generated copy";
  }

  const approved = items.filter((item) => item.reviewStatus === "approved").length;
  const draft = items.filter((item) => item.reviewStatus === "draft").length;

  return `${items.length} generated drafts, ${draft} awaiting review, ${approved} approved`;
}

function buildImageAnalysisEmptyCopy(media: ReturnType<typeof buildListingMediaSummary>) {
  if (media.activeCount) {
    return {
      title: "Image analysis is queued",
      body: "Photos are already in the gallery. Keep the background worker running so BullMQ can turn queued analysis jobs into reviewable AI assets."
    };
  }

  return {
    title: "No image analysis assets yet",
    body: "Upload a photo with AI analysis enabled. Results will appear here for review before they update amenities."
  };
}

function buildPublicationSummary(listing: PropertySnapshot, media: ReturnType<typeof buildListingMediaSummary>) {
  const items = [
    {
      detail: media.activeCount ? `${media.activeCount} public-ready photos` : "Add at least one cover photo",
      label: "Gallery",
      ready: media.activeCount > 0
    },
    {
      detail: listing.description ? "Client-facing description exists" : "Generate or write public description",
      label: "Description",
      ready: Boolean(listing.description)
    },
    {
      detail: formatCompactMoney(listing.price),
      label: "Price",
      ready: listing.price.amount > 0
    },
    {
      detail: listing.amenities.length ? `${listing.amenities.length} tags available` : "Add searchable amenity tags",
      label: "Amenities",
      ready: listing.amenities.length > 0
    },
    {
      detail: listing.status === "available" ? "Visible candidate" : `Currently ${formatBucket(listing.status)}`,
      label: "Availability",
      ready: listing.status === "available"
    },
    {
      detail:
        listing.rentalPriceMonthly || listing.monthlyRentEstimate || listing.maintenanceFeeMonthly
          ? "Economics enrich public AI summary"
          : "Add rent or ownership cost signal",
      label: "Economics",
      ready: Boolean(listing.rentalPriceMonthly || listing.monthlyRentEstimate || listing.maintenanceFeeMonthly)
    }
  ];
  const readyCount = items.filter((item) => item.ready).length;

  return {
    items,
    previewHref: buildPublicPreviewHref(listing.id),
    title: `${readyCount}/${items.length} public fields ready`
  };
}

function buildPublicPreviewHref(propertyId: string) {
  const webBaseUrl = process.env.NEXT_PUBLIC_PROPERTYFLOW_WEB_URL ?? "http://localhost:3000";

  return `${webBaseUrl.replace(/\/$/, "")}/properties/${propertyId}`;
}

function buildEconomics(listing: PropertySnapshot) {
  const rent = listing.monthlyRentEstimate ?? listing.rentalPriceMonthly;
  const grossYield = rent && listing.price.amount > 0 ? (rent.amount * 12) / listing.price.amount : undefined;

  return {
    annualRentValue: rent ? formatMoney({ ...rent, amount: rent.amount * 12 }) : "not estimated",
    grossYieldValue: grossYield ? formatPercent(grossYield, { maximumFractionDigits: 1 }) : "not enough data",
    maintenanceValue: listing.maintenanceFeeMonthly ? `${formatMoney(listing.maintenanceFeeMonthly)}/mo` : "not set",
    pricePerSqm: listing.areaSqm > 0 ? formatMoney({ ...listing.price, amount: listing.price.amount / listing.areaSqm }) : "not set",
    rentNote: listing.rentalPriceMonthly ? "Listed monthly rent" : rent ? "AI rent estimate" : "Needs rent signal",
    rentValue: rent ? `${formatCompactMoney(rent)}/mo` : "not set",
    yieldQuality: grossYield ? getYieldQuality(grossYield) : "needs rent estimate"
  };
}

function getReadiness(listing: PropertySnapshot) {
  const checks = [
    { done: Boolean(listing.description), label: "Description" },
    { done: listing.amenities.length >= 4, label: "Amenity depth" },
    { done: Boolean(listing.beachDistanceMeters), label: "Distance context" },
    { done: Boolean(listing.monthlyRentEstimate || listing.rentalPriceMonthly), label: "Rent signal" },
    { done: Boolean(listing.maintenanceFeeMonthly), label: "Ownership cost" }
  ];
  const score = checks.filter((check) => check.done).length;
  const note = score >= 4 ? "Ready for AI-assisted pitching" : "Needs enrichment";

  return { checks, note, score };
}

function buildNextActions(listing: PropertySnapshot, readinessScore: number) {
  const actions = [];

  if (!listing.description) {
    actions.push({
      body: "Generate multilingual copy before sending this listing to clients.",
      title: "Run AI description"
    });
  }

  if (listing.amenities.length < 4) {
    actions.push({
      body: "Add amenities from photos or agent notes so search, concierge, and compare can explain fit.",
      title: "Enrich amenities"
    });
  }

  if (!listing.monthlyRentEstimate && !listing.rentalPriceMonthly) {
    actions.push({
      body: "Add an estimated monthly rent to unlock yield, investment, and rental-readiness signals.",
      title: "Add rent estimate"
    });
  }

  if (!listing.beachDistanceMeters) {
    actions.push({
      body: "Add walking-distance context so the concierge can explain lifestyle and relocation fit.",
      title: "Add location context"
    });
  }

  if (!listing.maintenanceFeeMonthly) {
    actions.push({
      body: "Capture monthly maintenance to make ownership costs and investment comparisons credible.",
      title: "Add ownership cost"
    });
  }

  if (readinessScore >= 4) {
    actions.push({
      body: "Use this object in concierge recommendations and compare flows for active matching leads.",
      title: "Push to client matching"
    });
  }

  return actions.slice(0, 3);
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

function formatCompactMoney(value: PropertySnapshot["price"]) {
  return new Intl.NumberFormat("en", {
    currency: value.currency,
    maximumFractionDigits: value.amount >= 1_000_000 ? 1 : 0,
    notation: "compact",
    style: "currency"
  }).format(value.amount);
}
