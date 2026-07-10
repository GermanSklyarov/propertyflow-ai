"use client";

import Link from "next/link";
import { Bath, BedDouble, Check, MapPin, Plus, Ruler, Waves } from "lucide-react";
import type { PropertySnapshot } from "@propertyflow/domain";
import { useCompareSelectionStore } from "../../../features/property-compare/model/compare-selection-store";
import { formatCompactThb } from "../../../shared/lib/format-money";
import { propertyImage } from "../lib/property-image";

export function PropertyCard({ property, priority }: { property: PropertySnapshot; priority?: boolean }) {
  const imageUrl = propertyImage(property, priority);
  const isSelectedForCompare = useCompareSelectionStore((state) => state.isSelected(property.id));
  const toggleProperty = useCompareSelectionStore((state) => state.toggleProperty);
  const yieldEstimate =
    property.monthlyRentEstimate && property.price.amount > 0
      ? ((property.monthlyRentEstimate.amount * 12) / property.price.amount) * 100
      : undefined;

  return (
    <article className="overflow-hidden border border-[var(--line)] bg-[var(--panel-strong)] shadow-[0_16px_46px_rgba(37,50,46,0.1)] transition hover:-translate-y-0.5 hover:border-[rgba(15,118,110,0.36)] hover:shadow-[0_20px_56px_rgba(37,50,46,0.14)]">
      <Link className="block" href={`/properties/${property.id}`}>
        <div className="relative aspect-[1.35] bg-[#dbe3dc]">
          <img
            className="block size-full object-cover"
            src={imageUrl}
            alt={property.title}
            loading={priority ? "eager" : "lazy"}
          />
          <span className="absolute left-3 top-3 bg-white/90 px-2.5 py-1.5 text-[0.76rem] font-black uppercase text-[var(--teal-dark)]">
            {listingLabel(property.listingType)} · {property.market}
          </span>
        </div>
        <div className="p-4 pb-3">
          <div className="grid gap-3 min-[761px]:flex min-[761px]:items-start min-[761px]:justify-between min-[761px]:gap-3.5">
            <div>
              <h3 className="m-0 text-[1.08rem]">{property.title}</h3>
              <p className="mt-1.5 flex items-center gap-1.5 text-[0.84rem] text-[var(--muted)]">
                <MapPin size={14} />
                {property.address ?? property.market}
              </p>
            </div>
            <strong
              className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-[1.02rem] text-[var(--coral)] min-[761px]:max-w-[175px] min-[761px]:text-right"
              title={primaryPrice(property)}
            >
              {primaryPrice(property)}
            </strong>
          </div>
          <p className="my-3.5 line-clamp-3 min-h-[62px] overflow-hidden text-[0.92rem] leading-normal text-[#52615d]">
            {property.description}
          </p>
          <div className="grid grid-cols-2 gap-1.5 min-[761px]:grid-cols-4">
            <span className="inline-flex min-h-[34px] items-center justify-center gap-1 border border-[var(--line)] text-[0.78rem] font-extrabold text-[#364642]">
              <BedDouble size={15} />
              {property.bedrooms}
            </span>
            <span className="inline-flex min-h-[34px] items-center justify-center gap-1 border border-[var(--line)] text-[0.78rem] font-extrabold text-[#364642]">
              <Bath size={15} />
              {property.bathrooms}
            </span>
            <span className="inline-flex min-h-[34px] items-center justify-center gap-1 border border-[var(--line)] text-[0.78rem] font-extrabold text-[#364642]">
              <Ruler size={15} />
              {property.areaSqm} sqm
            </span>
            <span className="inline-flex min-h-[34px] items-center justify-center gap-1 border border-[var(--line)] text-[0.78rem] font-extrabold text-[#364642]">
              <Waves size={15} />
              {property.beachDistanceMeters ? `${property.beachDistanceMeters}m` : "nearby"}
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            <span className="inline-flex min-h-[34px] items-center justify-center gap-1 border border-[rgba(197,154,53,0.3)] bg-[rgba(197,154,53,0.12)] text-center text-[0.78rem] font-extrabold text-[#364642]">
              {yieldEstimate ? `${yieldEstimate.toFixed(1)}% gross yield` : "Yield pending"}
            </span>
            <span className="inline-flex min-h-[34px] items-center justify-center gap-1 border border-[var(--line)] text-center text-[0.78rem] font-extrabold text-[#364642]">
              {property.amenities.slice(0, 2).join(" / ")}
            </span>
          </div>
        </div>
      </Link>

      <div className="px-4 pb-4">
        <button
          aria-pressed={isSelectedForCompare}
          className={`inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 border px-3 py-2 text-[0.82rem] font-black shadow-[0_8px_20px_rgba(37,50,46,0.04)] transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(37,50,46,0.12)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(15,118,110,0.18)] ${
            isSelectedForCompare
              ? "border-[rgba(15,118,110,0.55)] bg-[var(--teal)] text-white hover:bg-[var(--teal-dark)]"
              : "border-[var(--line)] bg-white text-[var(--teal-dark)] hover:border-[rgba(15,118,110,0.42)] hover:bg-[#edf8f4]"
          }`}
          onClick={() => toggleProperty(property.id)}
          type="button"
        >
          {isSelectedForCompare ? <Check size={16} /> : <Plus size={16} />}
          {isSelectedForCompare ? "Added to AI compare" : "Add to AI compare"}
        </button>
      </div>
    </article>
  );
}

function primaryPrice(property: PropertySnapshot) {
  if (property.listingType === "rent" && property.rentalPriceMonthly) {
    return `${formatCompactThb(property.rentalPriceMonthly.amount)}/mo`;
  }

  if (property.listingType === "sale_or_rent" && property.rentalPriceMonthly) {
    return `${formatCompactThb(property.price.amount)} · ${formatCompactThb(property.rentalPriceMonthly.amount)}/mo`;
  }

  return formatCompactThb(property.price.amount);
}

function listingLabel(listingType: PropertySnapshot["listingType"]) {
  if (listingType === "sale_or_rent") {
    return "sale/rent";
  }

  return listingType;
}
