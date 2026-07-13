import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket } from "@shared/lib/formatters";
import { formatCompactListingMoney } from "./listing-formatters";

export function buildListingPublicationSummary(listing: PropertySnapshot, activeImageCount: number) {
  const items = [
    {
      detail: activeImageCount ? `${activeImageCount} public-ready photos` : "Add at least one cover photo",
      label: "Gallery",
      ready: activeImageCount > 0
    },
    {
      detail: listing.description ? "Client-facing description exists" : "Generate or write public description",
      label: "Description",
      ready: Boolean(listing.description)
    },
    {
      detail: formatCompactListingMoney(listing.price),
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

export function buildListingReadiness(listing: PropertySnapshot) {
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

export function buildListingNextActions(listing: PropertySnapshot, readinessScore: number) {
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

function buildPublicPreviewHref(propertyId: string) {
  const webBaseUrl = process.env.NEXT_PUBLIC_PROPERTYFLOW_WEB_URL ?? "http://localhost:3000";

  return `${webBaseUrl.replace(/\/$/, "")}/properties/${propertyId}`;
}
