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
    <div className="listing-intent-shell">
      <div className="listing-intent-bar" aria-label="Listing intent">
        {intentOptions.map((option) => {
          const Icon = option.icon;
          const count = countByIntent(properties, option.value);

          return (
            <button
              aria-pressed={intent === option.value}
              className="intent-button"
              key={option.value}
              onClick={() => setIntent(option.value)}
              type="button"
            >
              <Icon size={16} />
              <span>{option.label}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>

      <div className="intent-insight">
        <span>{intentCopy(intent)}</span>
        <strong>
          {rentalBudget
            ? `${formatCompactThb(rentalBudget.min)}-${formatCompactThb(rentalBudget.max)}/mo rental band`
            : "Rental prices appear when agents publish rent listings"}
        </strong>
      </div>

      {filteredProperties.length ? (
        <div className="property-grid">
          {filteredProperties.map((property, index) => (
            <PropertyCard key={property.id} property={property} priority={index === 0} />
          ))}
        </div>
      ) : (
        <div className="empty-listing-state">
          <h3>No matching listings yet</h3>
          <p>Keep the intent filter active and ask Concierge to broaden the area, budget, or lease length.</p>
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
