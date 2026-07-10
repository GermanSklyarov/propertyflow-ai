import { ArrowLeft, Bath, BedDouble, Building2, MapPin, Ruler, ShieldCheck, Sparkles, Waves, Wifi } from "lucide-react";
import type { PropertySnapshot } from "@propertyflow/domain";
import { propertyImage } from "../../../entities/property/lib/property-image";
import { LeadCaptureForm } from "../../../features/lead-capture/ui/lead-capture-form";
import { formatCompactThb } from "../../../shared/lib/format-money";

export function PropertyDetailsPage({ property }: { property: PropertySnapshot }) {
  const yieldEstimate = grossYield(property);
  const annualRent = property.monthlyRentEstimate
    ? property.monthlyRentEstimate.amount * 12
    : undefined;

  return (
    <main className="bg-[#f7f6ef]">
      <section className="grid min-h-[72vh] bg-[#101d1a] text-white min-[1081px]:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.78fr)]">
        <div className="min-h-[300px] min-[761px]:min-h-[420px] min-[1081px]:min-h-[520px]">
          <img className="block size-full object-cover" src={propertyImage(property, true)} alt={property.title} />
        </div>
        <div className="grid content-center gap-4 px-[18px] py-7 min-[761px]:p-[clamp(28px,5vw,72px)]">
          <a className="inline-flex w-fit items-center gap-2 text-[0.88rem] font-extrabold text-white/80" href="/#recommendations">
            <ArrowLeft size={16} />
            Back to matches
          </a>
          <p className="eyebrow">AI property brief</p>
          <h1 className="m-0 text-[clamp(2.7rem,5.8vw,6.4rem)] leading-none">{property.title}</h1>
          <p className="m-0 inline-flex items-center gap-2 font-extrabold text-white/75">
            <MapPin size={18} />
            {property.address ?? property.market}
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <strong className="text-[clamp(1.5rem,2.4vw,2.4rem)] text-[#ffb199]">{primaryPrice(property)}</strong>
            <span className="bg-white/10 px-2.5 py-2 text-[0.78rem] font-black uppercase text-white">
              {listingLabel(property.listingType)}
            </span>
          </div>
          <p className="m-0 max-w-[680px] text-[1.05rem] leading-relaxed text-white/75">{property.description}</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1320px] grid-cols-1 gap-[18px] px-[clamp(18px,4vw,54px)] pb-14 pt-7 min-[1081px]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-[18px]">
          <section className="border border-[var(--line)] bg-white p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
            <div className="flex items-start justify-between gap-[18px]">
              <div>
                <p className="section-kicker">AI Summary</p>
                <h2 className="mt-2 max-w-[720px] text-[clamp(1.55rem,2.8vw,2.7rem)] leading-tight">
                  {summaryTitle(property)}
                </h2>
              </div>
              <Sparkles size={22} />
            </div>
            <div className="mt-[22px] grid grid-cols-1 gap-3 min-[761px]:grid-cols-2">
              <BriefColumn title="Pros" items={pros(property)} tone="good" />
              <BriefColumn title="Tradeoffs" items={tradeoffs(property)} tone="warn" />
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
              <ScoreRow label="Beach" value={scoreBeach(property)} />
              <ScoreRow label="Restaurants" value={4} />
              <ScoreRow label="Remote work" value={property.amenities.some((amenity) => amenity.includes("internet")) ? 5 : 3} />
              <ScoreRow label="Quiet living" value={property.address?.toLowerCase().includes("jomtien") ? 5 : 4} />
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-[18px]">
          <LeadCaptureForm property={property} />

          <section className="border border-[var(--line)] bg-white p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
            <p className="section-kicker">Economics</p>
            <div className="mt-[18px] grid gap-2.5">
              <DetailMetric label="Purchase price" value={formatCompactThb(property.price.amount)} />
              <DetailMetric
                label="Monthly rent ask"
                value={property.rentalPriceMonthly ? `${formatCompactThb(property.rentalPriceMonthly.amount)}/mo` : "Not listed"}
              />
              <DetailMetric
                label="Rent estimate"
                value={property.monthlyRentEstimate ? `${formatCompactThb(property.monthlyRentEstimate.amount)}/mo` : "Pending"}
              />
              <DetailMetric label="Gross yield" value={yieldEstimate ? `${yieldEstimate.toFixed(1)}%` : "Pending"} />
              <DetailMetric label="Annual rent signal" value={annualRent ? formatCompactThb(annualRent) : "Pending"} />
            </div>
          </section>

          <section className="border border-[var(--line)] bg-white p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
            <p className="section-kicker">Facts</p>
            <div className="mt-4 grid grid-cols-1 gap-2 min-[761px]:grid-cols-2">
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
                {property.beachDistanceMeters ? `${property.beachDistanceMeters}m` : "near beach"}
              </span>
              <span className="inline-flex items-center gap-2 border border-[var(--line)] p-2.5 text-[0.86rem] font-extrabold text-[#364642]">
                <Building2 size={16} />
                Floor {property.floor ?? "ask"}
              </span>
              <span className="inline-flex items-center gap-2 border border-[var(--line)] p-2.5 text-[0.86rem] font-extrabold text-[#364642]">
                <Wifi size={16} />
                {property.amenities.includes("fiber internet") ? "fiber" : "internet check"}
              </span>
            </div>
          </section>

          <section className="border border-[var(--line)] bg-white p-[clamp(18px,2vw,26px)] shadow-[0_16px_42px_rgba(37,50,46,0.08)]">
            <p className="section-kicker">Ask agent</p>
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {questions(property).map((question) => (
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

function BriefColumn({ title, items, tone }: { title: string; items: string[]; tone: "good" | "warn" }) {
  return (
    <div className={`border border-[var(--line)] p-4 ${tone === "good" ? "bg-[#edf8f4]" : "bg-[#fff6eb]"}`}>
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
    <div className="grid items-start gap-3.5 border-b border-[var(--line)] py-2.5 min-[761px]:flex min-[761px]:items-center min-[761px]:justify-between">
      <span className="font-extrabold text-[var(--muted)]">{label}</span>
      <strong className="text-left text-[var(--ink)] min-[761px]:text-right">{value}</strong>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid items-start gap-3.5 border-b border-[var(--line)] py-2.5 min-[761px]:flex min-[761px]:items-center min-[761px]:justify-between">
      <span className="font-extrabold text-[var(--muted)]">{label}</span>
      <strong className="text-[var(--gold)]" aria-label={`${label}: ${value} out of 5`}>
        {"★".repeat(value)}{"☆".repeat(5 - value)}
      </strong>
    </div>
  );
}

function primaryPrice(property: PropertySnapshot) {
  if (property.listingType === "rent" && property.rentalPriceMonthly) {
    return `${formatCompactThb(property.rentalPriceMonthly.amount)}/mo`;
  }

  if (property.listingType === "sale_or_rent" && property.rentalPriceMonthly) {
    return `${formatCompactThb(property.price.amount)} or ${formatCompactThb(property.rentalPriceMonthly.amount)}/mo`;
  }

  return formatCompactThb(property.price.amount);
}

function listingLabel(listingType: PropertySnapshot["listingType"]) {
  if (listingType === "sale_or_rent") {
    return "Sale or rent";
  }

  return listingType === "rent" ? "For rent" : "For sale";
}

function grossYield(property: PropertySnapshot) {
  if (!property.monthlyRentEstimate || property.price.amount <= 0) {
    return undefined;
  }

  return ((property.monthlyRentEstimate.amount * 12) / property.price.amount) * 100;
}

function summaryTitle(property: PropertySnapshot) {
  if (property.listingType === "rent") {
    return "Strong short-stay base with simple monthly economics.";
  }

  if (property.listingType === "sale_or_rent") {
    return "Flexible asset: usable for winter living, rent, or resale.";
  }

  return "Ownership case with rental-demand upside.";
}

function pros(property: PropertySnapshot) {
  return [
    property.beachDistanceMeters && property.beachDistanceMeters <= 600 ? "Beach access is comfortably walkable." : "Area fit can work with local transport.",
    property.monthlyRentEstimate ? "Rental demand signal is available for ROI checks." : "Useful baseline for lifestyle search.",
    property.amenities.slice(0, 2).join(" and ") || "Core property facts are ready for agent review."
  ];
}

function tradeoffs(property: PropertySnapshot) {
  return [
    property.floor && property.floor > 18 ? "High floor should be checked for heat and lift wait times." : "View and street noise need on-site validation.",
    property.maintenanceFeeMonthly ? "Maintenance fee should be included in net yield." : "Maintenance fee is not confirmed yet.",
    property.listingType === "rent" ? "Lease terms, deposit, and utility policy still need confirmation." : "Final ownership costs depend on transfer and legal checks."
  ];
}

function scoreBeach(property: PropertySnapshot) {
  if (!property.beachDistanceMeters) {
    return 3;
  }

  if (property.beachDistanceMeters <= 400) {
    return 5;
  }

  if (property.beachDistanceMeters <= 900) {
    return 4;
  }

  return 3;
}

function questions(property: PropertySnapshot) {
  return [
    property.listingType === "rent" ? "What lease length and deposit are acceptable?" : "What transfer fees and sinking fund apply?",
    "Can the agent confirm noise level at night?",
    "Are internet speed and building maintenance documents available?"
  ];
}
