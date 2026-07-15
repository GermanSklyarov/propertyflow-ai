import {
  ArrowLeft,
  Bath,
  BedDouble,
  Building2,
  MapPin,
  Ruler,
  ShieldCheck,
  Sparkles,
  Waves,
  Wifi,
} from "lucide-react";
import type { PropertyImageGalleryResponse, PropertyImageSnapshot } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { propertyImage } from "@entities/property/lib/property-image";
import { buildPropertyBrief } from "@entities/property/model/property-brief";
import { buildPropertyEconomics } from "@entities/property/model/property-economics";
import {
  buildPropertyPriceHistory,
  getPriceHistoryBars,
} from "@entities/property/model/property-price-history";
import { LeadCaptureForm } from "@features/lead-capture/ui/lead-capture-form";
import { formatCompactThb } from "@shared/lib/format-money";
import styles from "./property-details-page.module.css";

export function PropertyDetailsPage({
  backHref = "/#recommendations",
  gallery,
  property,
}: {
  backHref?: string;
  gallery: PropertyImageGalleryResponse;
  property: PropertySnapshot;
}) {
  const brief = buildPropertyBrief(property);
  const economics = buildPropertyEconomics(property);
  const media = buildPropertyMedia(property, gallery);
  const priceHistory = buildPropertyPriceHistory(property);
  const priceHistoryBars = getPriceHistoryBars(priceHistory);

  return (
    <main className="bg-[#f7f6ef]">
      <section
        className={`grid min-h-[72vh] bg-[#101d1a] text-white ${styles.hero}`}
      >
        <div className={styles.heroMedia}>
          <img
            className="block size-full object-cover"
            src={media.cover.imageUrl}
            alt={media.cover.caption ?? property.title}
          />
        </div>
        <div className={`grid content-center gap-4 ${styles.heroContent}`}>
          <a
            className="inline-flex w-fit items-center gap-2 text-[0.88rem] font-extrabold text-white/80"
            href={backHref}
          >
            <ArrowLeft size={16} />
            Back to matches
          </a>
          <p className="eyebrow">AI property brief</p>
          <h1 className="m-0 text-[clamp(2.7rem,5.8vw,6.4rem)] leading-none">
            {property.title}
          </h1>
          <p className="m-0 inline-flex items-center gap-2 font-extrabold text-white/75">
            <MapPin size={18} />
            {property.address ?? property.market}
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <strong className="text-[clamp(1.5rem,2.4vw,2.4rem)] text-[#ffb199]">
              {brief.primaryPrice}
            </strong>
            <span className="bg-white/10 px-2.5 py-2 text-[0.78rem] font-black uppercase text-white">
              {brief.listingLabel}
            </span>
          </div>
          <p className="m-0 max-w-[680px] text-[1.05rem] leading-relaxed text-white/75">
            {property.description}
          </p>
        </div>
      </section>

      <section
        className={`mx-auto grid max-w-[1320px] gap-[18px] px-[clamp(18px,4vw,54px)] pb-14 pt-7 ${styles.contentGrid}`}
      >
        <div className="grid content-start gap-[18px]">
          <section className="border border-[var(--line)] bg-white p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
            <div className="flex items-start justify-between gap-[18px]">
              <div>
                <p className="section-kicker">Property gallery</p>
                <h2 className="mt-2 max-w-[720px] text-[clamp(1.55rem,2.8vw,2.7rem)] leading-tight">
                  {media.title}
                </h2>
              </div>
              <span className="border border-[var(--line)] bg-[#edf8f4] px-3 py-2 text-[0.78rem] font-black uppercase text-[var(--teal-dark)]">
                {media.images.length} photos
              </span>
            </div>
            <div className={`mt-[18px] grid gap-3 ${styles.galleryGrid}`}>
              {media.images.map((image, index) => (
                <figure className={index === 0 ? styles.galleryHero : styles.galleryThumb} key={image.id}>
                  <img
                    src={buildPublicGalleryImageSrc(image)}
                    alt={image.caption ?? `${property.title} photo ${index + 1}`}
                  />
                  <figcaption>{index === 0 ? "Cover photo" : `Photo ${index + 1}`}</figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="border border-[var(--line)] bg-white p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
            <div className="flex items-start justify-between gap-[18px]">
              <div>
                <p className="section-kicker">AI Summary</p>
                <h2 className="mt-2 max-w-[720px] text-[clamp(1.55rem,2.8vw,2.7rem)] leading-tight">
                  {brief.summaryTitle}
                </h2>
              </div>
              <Sparkles size={22} />
            </div>
            <div className={`mt-[22px] grid gap-3 ${styles.twoColumn}`}>
              <BriefColumn title="Pros" items={brief.pros} tone="good" />
              <BriefColumn
                title="Tradeoffs"
                items={brief.tradeoffs}
                tone="warn"
              />
            </div>
          </section>

          <section className="border border-[var(--line)] bg-white p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
            <div className="flex items-start justify-between gap-[18px]">
              <div>
                <p className="section-kicker">Price history</p>
                <h2 className="mt-2 max-w-[720px] text-[clamp(1.55rem,2.8vw,2.7rem)] leading-tight">
                  {priceHistory.changeLabel}
                </h2>
              </div>
              <Sparkles size={22} />
            </div>
            <div className="mt-[18px] grid min-h-[220px] grid-cols-5 items-end gap-2 border-b border-[var(--line)] pb-3">
              {priceHistoryBars.map((point) => (
                <div
                  className="grid h-full min-h-[190px] content-end gap-2"
                  key={point.label}
                >
                  <span className="text-center text-[0.72rem] font-black text-[var(--muted)]">
                    {point.valueLabel}
                  </span>
                  <div
                    aria-label={`${point.label}: ${point.valueLabel}`}
                    className="min-h-8 bg-[var(--teal)]"
                    style={{ height: `${point.heightPercent}%` }}
                  />
                  <span className="text-center text-[0.78rem] font-black text-[var(--teal-dark)]">
                    {point.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[var(--line)] bg-white p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
            <div className="flex items-start justify-between gap-[18px]">
              <div>
                <p className="section-kicker">Investment calculator</p>
                <h2 className="mt-2 max-w-[720px] text-[clamp(1.55rem,2.8vw,2.7rem)] leading-tight">
                  Net economics before legal and transfer checks.
                </h2>
              </div>
              <Sparkles size={22} />
            </div>
            <div className={`mt-[18px] grid gap-2.5 ${styles.twoColumn}`}>
              {economics.calculatorRows.map((row) => (
                <DetailMetric
                  label={row.label}
                  value={row.value}
                  key={row.label}
                />
              ))}
            </div>
          </section>

          <section className="border border-[var(--line)] bg-white p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
            <div className="flex items-start justify-between gap-[18px]">
              <div>
                <p className="section-kicker">Life around it</p>
                <h2 className="mt-2 max-w-[720px] text-[clamp(1.55rem,2.8vw,2.7rem)] leading-tight">
                  Neighborhood intelligence
                </h2>
              </div>
              <MapPin size={22} />
            </div>
            <div className="mt-[18px] grid gap-2.5">
              {brief.neighborhoodRows.map((row) => (
                <ScoreRow label={row.label} value={row.value} key={row.label} />
              ))}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-[18px]">
          <LeadCaptureForm property={property} />

          <section className="border border-[var(--line)] bg-white p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
            <p className="section-kicker">Economics</p>
            <div className="mt-[18px] grid gap-2.5">
              <DetailMetric
                label="Purchase price"
                value={formatCompactThb(property.price.amount)}
              />
              <DetailMetric
                label="Monthly rent ask"
                value={
                  property.rentalPriceMonthly
                    ? `${formatCompactThb(property.rentalPriceMonthly.amount)}/mo`
                    : "Not listed"
                }
              />
              <DetailMetric
                label="Rent estimate"
                value={
                  property.monthlyRentEstimate
                    ? `${formatCompactThb(property.monthlyRentEstimate.amount)}/mo`
                    : "Pending"
                }
              />
              <DetailMetric
                label="Gross yield"
                value={
                  brief.grossYield
                    ? `${brief.grossYield.toFixed(1)}%`
                    : "Pending"
                }
              />
              <DetailMetric
                label="Annual rent signal"
                value={
                  brief.annualRentSignal
                    ? formatCompactThb(brief.annualRentSignal)
                    : "Pending"
                }
              />
            </div>
          </section>

          <section className="border border-[var(--line)] bg-white p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
            <p className="section-kicker">Facts</p>
            <div className={`mt-4 grid gap-2 ${styles.twoColumn}`}>
              <span className="inline-flex items-center gap-2 border border-[var(--line)] p-2.5 text-[0.86rem] font-extrabold text-[#364642]">
                <BedDouble size={16} />
                {property.bedrooms} beds
              </span>
              <span className="inline-flex items-center gap-2 border border-[var(--line)] p-2.5 text-[0.86rem] font-extrabold text-[#364642]">
                <Bath size={16} />
                {property.bathrooms} baths
              </span>
              <span className="inline-flex items-center gap-2 border border-[var(--line)] p-2.5 text-[0.86rem] font-extrabold text-[#364642]">
                <Ruler size={16} />
                {property.areaSqm} sqm
              </span>
              <span className="inline-flex items-center gap-2 border border-[var(--line)] p-2.5 text-[0.86rem] font-extrabold text-[#364642]">
                <Waves size={16} />
                {property.beachDistanceMeters
                  ? `${property.beachDistanceMeters}m`
                  : "near beach"}
              </span>
              <span className="inline-flex items-center gap-2 border border-[var(--line)] p-2.5 text-[0.86rem] font-extrabold text-[#364642]">
                <Building2 size={16} />
                Floor {property.floor ?? "ask"}
              </span>
              <span className="inline-flex items-center gap-2 border border-[var(--line)] p-2.5 text-[0.86rem] font-extrabold text-[#364642]">
                <Wifi size={16} />
                {property.amenities.includes("fiber internet")
                  ? "fiber"
                  : "internet check"}
              </span>
            </div>
          </section>

          <section className="border border-[var(--line)] bg-white p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
            <p className="section-kicker">Ask agent</p>
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {brief.questions.map((question) => (
                <li
                  className="inline-flex items-start gap-2 border border-[var(--line)] p-2.5 text-[0.86rem] font-extrabold leading-normal text-[#364642]"
                  key={question}
                >
                  <ShieldCheck size={15} />
                  {question}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </section>
    </main>
  );
}

function buildPropertyMedia(property: PropertySnapshot, gallery: PropertyImageGalleryResponse) {
  const activeImages = [...gallery.images]
    .filter((image) => !image.deletedAt)
    .sort((first, second) => first.position - second.position);
  const fallbackCover = {
    caption: property.title,
    id: `${property.id}-fallback-cover`,
    imageUrl: propertyImage(property, true),
    position: 0,
    propertyId: property.id
  } satisfies Pick<PropertyImageSnapshot, "caption" | "id" | "imageUrl" | "position" | "propertyId">;
  const images = activeImages.length ? activeImages : [fallbackCover];

  return {
    cover: images[0],
    images,
    title: activeImages.length ? "Synced from agency media library." : "Preview image until agency photos are uploaded."
  };
}

function buildPublicGalleryImageSrc(
  image: Pick<PropertyImageSnapshot, "id" | "imageUrl" | "objectKey" | "propertyId">
) {
  if (!image.objectKey) {
    return image.imageUrl;
  }

  return `/api/property-images/${encodeURIComponent(image.propertyId)}/${encodeURIComponent(image.id)}`;
}

function BriefColumn({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "good" | "warn";
}) {
  return (
    <div
      className={`border border-[var(--line)] p-4 ${tone === "good" ? "bg-[#edf8f4]" : "bg-[#fff6eb]"}`}
    >
      <h3 className="mb-2.5 mt-0">{title}</h3>
      <ul className="m-0 grid list-none gap-2.5 p-0">
        {items.map((item) => (
          <li className="leading-normal text-[#42524e]" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={`gap-3.5 border-b border-[var(--line)] py-2.5 ${styles.metricRow}`}
    >
      <span className="font-extrabold text-[var(--muted)]">{label}</span>
      <strong className={`text-[var(--ink)] ${styles.metricValue}`}>
        {value}
      </strong>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div
      className={`gap-3.5 border-b border-[var(--line)] py-2.5 ${styles.metricRow}`}
    >
      <span className="font-extrabold text-[var(--muted)]">{label}</span>
      <strong
        className="text-[var(--gold)]"
        aria-label={`${label}: ${value} out of 5`}
      >
        {"★".repeat(value)}
        {"☆".repeat(5 - value)}
      </strong>
    </div>
  );
}
