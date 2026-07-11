"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bath,
  BedDouble,
  Check,
  MapPin,
  Plus,
  Ruler,
  Sparkles,
  VolumeX,
  Waves,
  Wifi,
} from "lucide-react";
import type { PropertySnapshot } from "@propertyflow/domain";
import { useCompareSelectionStore } from "@features/property-compare/model/compare-selection-store";
import { useHasMounted } from "@shared/lib/use-has-mounted";
import { propertyDetailQueryOptions } from "../api/property-queries";
import { propertyImage } from "../lib/property-image";
import { buildPropertyCardMeta } from "../model/property-card-meta";
import styles from "./property-card.module.css";

const scoreChipIcons = {
  Beach: Waves,
  Quiet: VolumeX,
  Remote: Wifi,
};

export function PropertyCard({
  property,
  priority,
}: {
  property: PropertySnapshot;
  priority?: boolean;
}) {
  const hasMounted = useHasMounted();
  const queryClient = useQueryClient();
  const imageUrl = propertyImage(property, priority);
  const meta = buildPropertyCardMeta(property);
  const isPersistedSelectedForCompare = useCompareSelectionStore((state) =>
    state.isSelected(property.id),
  );
  const toggleProperty = useCompareSelectionStore(
    (state) => state.toggleProperty,
  );
  const isSelectedForCompare = hasMounted
    ? isPersistedSelectedForCompare
    : false;

  function prefetchPropertyDetails() {
    void queryClient.prefetchQuery(propertyDetailQueryOptions(property.id));
  }

  const compareButtonClassName = isSelectedForCompare
    ? `${styles.compareButton} ${styles.compareButtonActive}`
    : styles.compareButton;

  return (
    <article className={styles.card}>
      <Link
        className={styles.link}
        href={`/properties/${property.id}`}
        onFocus={prefetchPropertyDetails}
        onMouseEnter={prefetchPropertyDetails}
      >
        <div className={styles.media}>
          <img
            className={styles.image}
            src={imageUrl}
            alt={property.title}
            loading={priority ? "eager" : "lazy"}
          />
          <span className={styles.badge}>{meta.listingBadge}</span>
        </div>
        <div className={styles.body}>
          <div className={styles.header}>
            <div className={styles.headingBlock}>
              <h3 className={styles.title}>{property.title}</h3>
              <p className={styles.address}>
                <MapPin className="shrink-0" size={14} />
                <span className={styles.addressText}>
                  {property.address ?? property.market}
                </span>
              </p>
            </div>
            <strong className={styles.price} title={meta.priceLabel}>
              {meta.priceLabel}
            </strong>
          </div>
          <p className={styles.matchSignal}>
            <Sparkles size={14} />
            <span className={styles.matchText}>{meta.matchSignal}</span>
          </p>
          <p className={styles.description}>{property.description}</p>
          <div className={styles.facts}>
            <span className={styles.fact}>
              <BedDouble size={15} />
              {property.bedrooms}
            </span>
            <span className={styles.fact}>
              <Bath size={15} />
              {property.bathrooms}
            </span>
            <span className={styles.fact} title={`${property.areaSqm} sqm`}>
              <Ruler size={15} />
              <span className={styles.factText}>{property.areaSqm} sqm</span>
            </span>
            <span
              className={styles.fact}
              title={
                property.beachDistanceMeters
                  ? `${property.beachDistanceMeters}m to beach`
                  : "Beach nearby"
              }
            >
              <Waves size={15} />
              <span className={styles.factText}>
                {property.beachDistanceMeters
                  ? `${property.beachDistanceMeters}m`
                  : "nearby"}
              </span>
            </span>
          </div>
          <div className={styles.pills}>
            <span
              className={`${styles.pill} ${styles.yieldPill}`}
              title={meta.yieldLabel}
            >
              <span className={styles.pillText}>{meta.yieldLabel}</span>
            </span>
            <span className={styles.pill} title={meta.amenityLabel}>
              <span className={styles.pillText}>{meta.amenityLabel}</span>
            </span>
          </div>
          <div className={styles.scores}>
            {meta.scoreChips.map((chip) => {
              const Icon =
                scoreChipIcons[chip.label as keyof typeof scoreChipIcons];

              return (
                <span
                  aria-label={`${chip.label} score ${chip.value}`}
                  className={styles.score}
                  key={chip.label}
                  title={`${chip.label}: ${chip.value}`}
                >
                  <Icon aria-hidden="true" size={14} strokeWidth={2.3} />
                  {chip.value}
                </span>
              );
            })}
          </div>
        </div>
      </Link>

      <div className={styles.actions}>
        <button
          aria-pressed={isSelectedForCompare}
          className={compareButtonClassName}
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
