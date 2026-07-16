import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket } from "@shared/lib/formatters";
import { formatCompactListingMoney, formatListingType } from "./listing-formatters";

export type ListingSocialChannel = "line-voom" | "facebook" | "instagram";

export interface ListingSocialPostDraft {
  body: string;
  channel: ListingSocialChannel;
  cta: string;
  hashtags: string[];
  hook: string;
  label: string;
  status: "ready" | "review";
}

export function buildListingSocialPostDrafts(
  listing: PropertySnapshot,
  options: { publicPhotoCount: number } = { publicPhotoCount: 0 }
): ListingSocialPostDraft[] {
  const priceLine = buildPriceLine(listing);
  const market = formatBucket(listing.market);
  const projectLine = listing.project ? `${listing.project.name}, ${market}` : market;
  const amenityLine = buildAmenityLine(listing);
  const status: ListingSocialPostDraft["status"] = listing.description && options.publicPhotoCount > 0 ? "ready" : "review";
  const hashtags = buildHashtags(listing);

  return [
    {
      body: `${projectLine}. ${priceLine}. ${amenityLine} ${buildShortDescription(listing)}`,
      channel: "line-voom",
      cta: "Message the agency for availability, viewing slots, and updated ownership costs.",
      hashtags,
      hook: `${listing.title} is ready for a LINE VOOM property spotlight.`,
      label: "LINE VOOM",
      status
    },
    {
      body: `${listing.title} gives clients a clear ${formatListingType(listing.listingType).toLowerCase()} option in ${market}. ${buildShortDescription(
        listing
      )} ${amenityLine}`,
      channel: "facebook",
      cta: "Use this draft for a Facebook post with gallery photos and a lead form link.",
      hashtags,
      hook: `${listing.title}: ${priceLine}`,
      label: "Facebook",
      status
    },
    {
      body: `${market} property pick. ${priceLine}. ${amenityLine}`,
      channel: "instagram",
      cta: "Pair with the cover photo and first three gallery images for carousel publishing.",
      hashtags,
      hook: `${listing.title} in ${market}`,
      label: "Instagram",
      status
    }
  ];
}

function buildPriceLine(listing: PropertySnapshot) {
  if (listing.listingType === "rent" && listing.rentalPriceMonthly) {
    return `${formatCompactListingMoney(listing.rentalPriceMonthly)}/month`;
  }

  if (listing.listingType === "sale_or_rent" && listing.rentalPriceMonthly) {
    return `${formatCompactListingMoney(listing.price)} or ${formatCompactListingMoney(listing.rentalPriceMonthly)}/month`;
  }

  return formatCompactListingMoney(listing.price);
}

function buildAmenityLine(listing: PropertySnapshot) {
  const amenities = [...listing.amenities, ...(listing.project?.amenities ?? [])]
    .map(formatBucket)
    .filter(Boolean)
    .slice(0, 4);

  if (!amenities.length) {
    return "Add amenities before publishing to strengthen the post.";
  }

  return `Highlights: ${amenities.join(", ")}.`;
}

function buildShortDescription(listing: PropertySnapshot) {
  const fallback = `${listing.areaSqm} sqm ${formatBucket(listing.kind)} with ${listing.bedrooms} bedroom${listing.bedrooms === 1 ? "" : "s"}.`;
  const source = listing.description?.trim() || fallback;

  return source.length > 180 ? `${source.slice(0, 177).trim()}...` : source;
}

function buildHashtags(listing: PropertySnapshot) {
  const rawTags = [
    `${formatBucket(listing.market)} property`,
    "Thailand real estate",
    `${formatBucket(listing.kind)} ${listing.listingType === "rent" ? "rent" : "sale"}`,
    listing.project?.name
  ];

  return rawTags
    .filter((value): value is string => Boolean(value))
    .map(toHashtag)
    .filter((value, index, values) => value.length > 1 && values.indexOf(value) === index)
    .slice(0, 5);
}

function toHashtag(value: string) {
  const words = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return `#${words.map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`).join("")}`;
}
