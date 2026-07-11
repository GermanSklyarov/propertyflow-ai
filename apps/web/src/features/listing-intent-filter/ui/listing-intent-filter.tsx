"use client";

import { usePathname, useRouter } from "next/navigation";
import { Building2, Home, KeyRound, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PropertySnapshot } from "@propertyflow/domain";
import { PropertyCard } from "@entities/property/ui/property-card";
import {
  countPropertiesByIntent,
  filterPropertiesByIntent,
  getListingIntentSummary,
  listingIntentCopy,
  type ListingIntent
} from "@features/listing-intent-filter/model/listing-intent";
import { formatCompactThb } from "@shared/lib/format-money";

const intentOptions: Array<{ value: ListingIntent; label: string; icon: typeof Building2 }> = [
  { value: "all", label: "All", icon: Building2 },
  { value: "sale", label: "Buy", icon: Home },
  { value: "rent", label: "Rent", icon: KeyRound },
  { value: "sale_or_rent", label: "Dual", icon: RotateCcw }
];

export function ListingIntentFilter({
  initialIntent,
  properties
}: {
  initialIntent: ListingIntent;
  properties: PropertySnapshot[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [intent, setIntent] = useState<ListingIntent>(initialIntent);

  useEffect(() => {
    setIntent(initialIntent);
  }, [initialIntent]);

  const filteredProperties = useMemo(() => filterPropertiesByIntent(properties, intent), [intent, properties]);
  const intentSummary = useMemo(() => getListingIntentSummary(properties, intent), [intent, properties]);

  function chooseIntent(nextIntent: ListingIntent) {
    const nextSearchParams = new URLSearchParams(window.location.search);

    if (nextIntent === "all") {
      nextSearchParams.delete("intent");
    } else {
      nextSearchParams.set("intent", nextIntent);
    }

    const query = nextSearchParams.toString();

    setIntent(nextIntent);
    router.replace(`${pathname}${query ? `?${query}` : ""}#recommendations`, { scroll: false });
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-2 min-[761px]:grid-cols-2 min-[1081px]:grid-cols-4" aria-label="Listing intent">
        {intentOptions.map((option) => {
          const Icon = option.icon;
          const count = countPropertiesByIntent(properties, option.value);
          const isActive = intent === option.value;

          return (
            <button
              aria-pressed={isActive}
              className={`grid min-h-[46px] cursor-pointer grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 border px-3 py-2.5 text-left text-[var(--teal-dark)] transition duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(15,118,110,0.18)] ${
                isActive
                  ? "border-[rgba(15,118,110,0.55)] bg-[var(--teal)] text-white hover:bg-[var(--teal-dark)]"
                  : "border-[var(--line)] bg-white/70 hover:border-[rgba(15,118,110,0.42)] hover:bg-[#edf8f4]"
              }`}
              key={option.value}
              onClick={() => chooseIntent(option.value)}
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
        <span>{listingIntentCopy(intent)}</span>
        <strong className="text-[var(--teal-dark)] min-[761px]:whitespace-nowrap">
          {intentSummary.min !== undefined && intentSummary.max !== undefined
            ? `${formatCompactThb(intentSummary.min)}-${formatCompactThb(intentSummary.max)} ${intentSummary.label}`
            : "Budget range appears when agents publish matching listings"}
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
