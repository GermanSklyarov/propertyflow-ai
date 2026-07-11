"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowDownUp,
  Building2,
  Home,
  KeyRound,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PropertySnapshot } from "@propertyflow/domain";
import { featuredPropertiesQueryOptions } from "@entities/property/api/property-queries";
import { PropertyCard } from "@entities/property/ui/property-card";
import { aiPropertySearchMutationOptions } from "@features/ai-property-search/api/ai-property-search-mutations";
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
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const aiSearchMutation = useMutation(aiPropertySearchMutationOptions());

  useEffect(() => {
    setIntent(initialIntent);
    setVisibleLimit(pageSize);
  }, [initialIntent]);

  useEffect(() => {
    const interpretedListingType = aiSearchMutation.data?.filters.listingType;

    if (interpretedListingType) {
      setIntent(interpretedListingType);
    }
  }, [aiSearchMutation.data?.filters.listingType]);

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
  const activeAiSearch = aiSearchMutation.data;
  const activeCatalogProperties = activeAiSearch?.items ?? catalogProperties;
  const filteredProperties = useMemo(() => {
    return sortPropertiesForCatalog(
      filterPropertiesByIntent(activeCatalogProperties, intent),
      sort,
    );
  }, [activeCatalogProperties, intent, sort]);
  const intentSummary = useMemo(
    () => getListingIntentSummary(activeCatalogProperties, intent),
    [activeCatalogProperties, intent],
  );
  const canLoadMore = !activeAiSearch && filteredProperties.length >= visibleLimit;

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
    aiSearchMutation.reset();
    router.replace(`${pathname}${query ? `?${query}` : ""}#recommendations`, {
      scroll: false,
    });
  }

  function chooseSort(nextSort: ListingSort) {
    setSort(nextSort);
    setVisibleLimit(pageSize);
  }

  function runAiSearch() {
    const query = aiSearchQuery.trim();

    if (!query) {
      return;
    }

    setVisibleLimit(pageSize);
    aiSearchMutation.mutate({
      locale: /[а-яё]/i.test(query) ? "ru" : "en",
      query,
    });
  }

  function clearAiSearch() {
    setAiSearchQuery("");
    aiSearchMutation.reset();
    setVisibleLimit(pageSize);
  }

  return (
    <div className={styles.root}>
      <div className={styles.aiSearchPanel}>
        <div className={styles.aiSearchHeader}>
          <Sparkles size={16} />
          <span>AI Search</span>
        </div>
        <div className={styles.aiSearchControls}>
          <label className={styles.aiSearchInputWrap}>
            <Search size={16} />
            <input
              aria-label="Search listings with AI"
              className={styles.aiSearchInput}
              onChange={(event) => setAiSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  runAiSearch();
                }
              }}
              placeholder="Try: quiet condo near Terminal 21 under 4M THB"
              type="search"
              value={aiSearchQuery}
            />
          </label>
          <button
            className={styles.aiSearchButton}
            disabled={!aiSearchQuery.trim() || aiSearchMutation.isPending}
            onClick={runAiSearch}
            type="button"
          >
            {aiSearchMutation.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            Search
          </button>
          {activeAiSearch ? (
            <button
              aria-label="Clear AI search"
              className={styles.aiSearchClearButton}
              onClick={clearAiSearch}
              type="button"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
        {activeAiSearch ? (
          <div className={styles.aiSearchResult}>
            <strong>{activeAiSearch.interpretedIntent}</strong>
            <span>{activeAiSearch.rankingExplanation}</span>
          </div>
        ) : null}
      </div>

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
