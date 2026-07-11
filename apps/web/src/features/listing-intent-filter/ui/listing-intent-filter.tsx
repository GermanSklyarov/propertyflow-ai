"use client";

import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownUp,
  Building2,
  Home,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PropertySnapshot } from "@propertyflow/domain";
import { featuredPropertiesQueryOptions } from "@entities/property/api/property-queries";
import { PropertyCard } from "@entities/property/ui/property-card";
import {
  countPropertiesByIntent,
  filterPropertiesByIntent,
  getListingIntentSummary,
  listingIntentCopy,
  sortPropertiesForCatalog,
  type ListingIntent,
  type ListingSort,
} from "@features/listing-intent-filter/model/listing-intent";
import { formatCompactThb } from "@shared/lib/format-money";
import styles from "./listing-intent-filter.module.css";

const intentOptions: Array<{
  value: ListingIntent;
  label: string;
  icon: typeof Building2;
}> = [
  { value: "all", label: "All", icon: Building2 },
  { value: "sale", label: "Buy", icon: Home },
  { value: "rent", label: "Rent", icon: KeyRound },
  { value: "sale_or_rent", label: "Dual", icon: RotateCcw },
];

const sortOptions: Array<{ value: ListingSort; label: string }> = [
  { value: "ai-fit", label: "AI fit" },
  { value: "price-asc", label: "Lowest price" },
  { value: "yield-desc", label: "Highest yield" },
  { value: "beach-asc", label: "Closest beach" },
];

const pageSize = 12;

export function ListingIntentFilter({
  initialIntent,
  properties,
}: {
  initialIntent: ListingIntent;
  properties: PropertySnapshot[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [intent, setIntent] = useState<ListingIntent>(initialIntent);
  const [sort, setSort] = useState<ListingSort>("ai-fit");
  const [visibleLimit, setVisibleLimit] = useState(pageSize);

  useEffect(() => {
    setIntent(initialIntent);
    setVisibleLimit(pageSize);
  }, [initialIntent]);

  const apiListingType = intent === "all" ? undefined : intent;
  const propertiesQuery = useQuery({
    ...featuredPropertiesQueryOptions({
      limit: visibleLimit,
      listingType: apiListingType,
      sort,
    }),
    placeholderData: (previousData) => previousData ?? properties,
  });
  const catalogProperties = propertiesQuery.data ?? properties;
  const filteredProperties = useMemo(() => {
    return sortPropertiesForCatalog(
      filterPropertiesByIntent(catalogProperties, intent),
      sort,
    );
  }, [catalogProperties, intent, sort]);
  const intentSummary = useMemo(
    () => getListingIntentSummary(catalogProperties, intent),
    [catalogProperties, intent],
  );
  const canLoadMore = filteredProperties.length >= visibleLimit;

  function chooseIntent(nextIntent: ListingIntent) {
    const nextSearchParams = new URLSearchParams(window.location.search);

    if (nextIntent === "all") {
      nextSearchParams.delete("intent");
    } else {
      nextSearchParams.set("intent", nextIntent);
    }

    const query = nextSearchParams.toString();

    setIntent(nextIntent);
    setVisibleLimit(pageSize);
    router.replace(`${pathname}${query ? `?${query}` : ""}#recommendations`, {
      scroll: false,
    });
  }

  function chooseSort(nextSort: ListingSort) {
    setSort(nextSort);
    setVisibleLimit(pageSize);
  }

  return (
    <div className={styles.root}>
      <div className={styles.intentGrid} aria-label="Listing intent">
        {intentOptions.map((option) => {
          const Icon = option.icon;
          const count = countPropertiesByIntent(properties, option.value);
          const isActive = intent === option.value;
          const intentButtonClassName = isActive
            ? `${styles.intentButton} ${styles.intentButtonActive}`
            : styles.intentButton;
          const intentCountClassName = isActive
            ? `${styles.intentCount} ${styles.intentCountActive}`
            : styles.intentCount;

          return (
            <button
              aria-pressed={isActive}
              className={intentButtonClassName}
              key={option.value}
              onClick={() => chooseIntent(option.value)}
              type="button"
            >
              <Icon size={16} />
              <span className={styles.intentLabel}>{option.label}</span>
              <strong className={intentCountClassName}>{count}</strong>
            </button>
          );
        })}
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryText}>
          <span>{listingIntentCopy(intent)}</span>
          <div className={styles.summaryMeta}>
            <span>{filteredProperties.length} matching listings</span>
            {propertiesQuery.isFetching ? <span>Updating results</span> : null}
            <span>
              {intentSummary.min !== undefined &&
              intentSummary.max !== undefined
                ? `${formatCompactThb(intentSummary.min)}-${formatCompactThb(intentSummary.max)} ${intentSummary.label}`
                : "Budget range appears when agents publish matching listings"}
            </span>
          </div>
        </div>
        <label className={styles.sortLabel}>
          <ArrowDownUp size={15} />
          <select
            aria-label="Sort listings"
            className={styles.sortSelect}
            onChange={(event) => chooseSort(event.target.value as ListingSort)}
            value={sort}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredProperties.length ? (
        <>
          <div className={styles.propertyGrid}>
            {filteredProperties.map((property, index) => (
              <PropertyCard
                key={property.id}
                property={property}
                priority={index === 0}
              />
            ))}
          </div>
          {canLoadMore ? (
            <div className={styles.loadMoreRow}>
              <button
                className={styles.loadMoreButton}
                disabled={propertiesQuery.isFetching}
                onClick={() =>
                  setVisibleLimit((currentLimit) => currentLimit + pageSize)
                }
                type="button"
              >
                {propertiesQuery.isFetching
                  ? "Loading listings"
                  : "Load more listings"}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyTitle}>No matching listings yet</h3>
          <p className={styles.emptyText}>
            Keep the intent filter active and ask Concierge to broaden the area,
            budget, or lease length.
          </p>
        </div>
      )}
    </div>
  );
}
