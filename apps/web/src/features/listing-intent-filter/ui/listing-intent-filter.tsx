"use client";

import { Building2, Home, KeyRound, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import type { PropertyListingType, PropertySnapshot } from "@propertyflow/domain";
import { PropertyCard } from "../../../entities/property/ui/property-card";
import { formatCompactThb } from "../../../shared/lib/format-money";

type ListingIntent = "all" | PropertyListingType;

const intentOptions: Array<{
  value: ListingIntent;
  label: string;
  icon: typeof Building2;
}> = [
  { value: "all", label: "All", icon: Building2 },
  { value: "sale", label: "Buy", icon: Home },
  { value: "rent", label: "Rent", icon: KeyRound },
  { value: "sale_or_rent", label: "Dual", icon: RotateCcw }
];

export function ListingIntentFilter({ properties }: { properties: PropertySnapshot[] }) {
  const [intent, setIntent] = useState<ListingIntent>("all");

  const filteredProperties = useMemo(() => {
    if (intent === "all") {
      return properties;
    }

    if (intent === "rent") {
      return properties.filter((property) => property.listingType === "rent" || property.listingType === "sale_or_rent");
    }

    if (intent === "sale") {
      return properties.filter((property) => property.listingType === "sale" || property.listingType === "sale_or_rent");
    }

    return properties.filter((property) => property.listingType === intent);
  }, [intent, properties]);

  const rentalBudget = useMemo(() => {
    const rentalPrices = properties
      .map((property) => property.rentalPriceMonthly?.amount)
      .filter((amount): amount is number => typeof amount === "number");

    if (!rentalPrices.length) {
      return undefined;
    }

    return {
      min: Math.min(...rentalPrices),
      max: Math.max(...rentalPrices)
    };
  }, [properties]);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-2 min-[761px]:grid-cols-2 min-[1081px]:grid-cols-4" aria-label="Listing intent">
        {intentOptions.map((option) => {
          const Icon = option.icon;
          const count = countByIntent(properties, option.value);
          const isActive = intent === option.value;

          return (
            <button
              aria-pressed={isActive}
              className={`grid min-h-[46px] cursor-pointer grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 border px-3 py-2.5 text-left text-[var(--teal-dark)] ${
                isActive
                  ? "border-[rgba(15,118,110,0.55)] bg-[var(--teal)] text-white"
                  : "border-[var(--line)] bg-white/70"
              }`}
              key={option.value}
              onClick={() => setIntent(option.value)}
              type="button"
            >
              <Icon size={16} />
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.86rem] font-black">
                {option.label}
              </span>
              <strong
                className={`grid h-[26px] min-w-[26px] place-items-center text-[0.78rem] ${
                  isActive ? "bg-white/20 text-white" : "bg-[#edf8f4] text-[var(--teal-dark)]"
                }`}
              >
                {count}
              </strong>
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-3.5 border border-[rgba(15,118,110,0.16)] bg-[#edf8f4] px-3.5 py-3 text-[0.9rem] leading-normal text-[#42524e] min-[761px]:flex min-[761px]:items-center min-[761px]:justify-between">
        <span>{intentCopy(intent)}</span>
        <strong className="text-[var(--teal-dark)] min-[761px]:whitespace-nowrap">
          {rentalBudget
            ? `${formatCompactThb(rentalBudget.min)}-${formatCompactThb(rentalBudget.max)}/mo rental band`
            : "Rental prices appear when agents publish rent listings"}
        </strong>
      </div>

      {filteredProperties.length ? (
        <div className="grid grid-cols-1 gap-[18px] min-[761px]:grid-cols-2 min-[1081px]:grid-cols-3">
          {filteredProperties.map((property, index) => (
            <PropertyCard key={property.id} property={property} priority={index === 0} />
          ))}
        </div>
      ) : (
        <div className="border border-[var(--line)] bg-[var(--panel-strong)] p-7">
          <h3 className="mb-2 mt-0 text-xl">No matching listings yet</h3>
          <p className="m-0 max-w-[620px] leading-normal text-[var(--muted)]">
            Keep the intent filter active and ask Concierge to broaden the area, budget, or lease length.
          </p>
        </div>
      )}
    </div>
  );
}

function countByIntent(properties: PropertySnapshot[], intent: ListingIntent) {
  if (intent === "all") {
    return properties.length;
  }

  if (intent === "rent") {
    return properties.filter((property) => property.listingType === "rent" || property.listingType === "sale_or_rent").length;
  }

  if (intent === "sale") {
    return properties.filter((property) => property.listingType === "sale" || property.listingType === "sale_or_rent").length;
  }

  return properties.filter((property) => property.listingType === intent).length;
}

function intentCopy(intent: ListingIntent) {
  if (intent === "rent") {
    return "Rental mode highlights monthly ask, flexible move-in thinking, and lease-first conversations.";
  }

  if (intent === "sale") {
    return "Buy mode prioritizes acquisition price, resale liquidity, and ownership economics.";
  }

  if (intent === "sale_or_rent") {
    return "Dual listings are useful when an owner is open to either sale or lease strategy.";
  }

  return "Switch between purchase and rental intent without losing the AI-picked property context.";
}
