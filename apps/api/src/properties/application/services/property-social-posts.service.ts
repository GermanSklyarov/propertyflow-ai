import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  GeneratePropertySocialPostsRequest,
  GeneratePropertySocialPostsResponse,
  PropertySocialPostChannel,
  PropertySocialPostDraft,
  PropertySocialPostLocale
} from "@propertyflow/contracts";
import type { Money, PropertySnapshot } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

const allChannels: PropertySocialPostChannel[] = ["line-voom", "facebook", "instagram"];

@Injectable()
export class PropertySocialPostsService {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  async generateDrafts(
    tenantId: string,
    propertyId: string,
    request: GeneratePropertySocialPostsRequest = {}
  ): Promise<GeneratePropertySocialPostsResponse> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const locale = request.locale ?? "en";
    const channels = request.channels?.length ? request.channels : allChannels;
    const publicPhotoCount = request.publicPhotoCount ?? (property.coverImage ? 1 : 0);

    return {
      propertyId,
      locale,
      drafts: channels.map((channel) => buildDraft(property, channel, locale, publicPhotoCount))
    };
  }
}

function buildDraft(
  listing: PropertySnapshot,
  channel: PropertySocialPostChannel,
  locale: PropertySocialPostLocale,
  publicPhotoCount: number
): PropertySocialPostDraft {
  const priceLine = buildPriceLine(listing);
  const market = formatBucket(listing.market);
  const projectLine = listing.project ? `${listing.project.name}, ${market}` : market;
  const amenityLine = buildAmenityLine(listing);
  const status: PropertySocialPostDraft["status"] = listing.description && publicPhotoCount > 0 ? "ready" : "review";
  const hashtags = buildHashtags(listing);

  if (channel === "line-voom") {
    return {
      body: `${projectLine}. ${priceLine}. ${amenityLine} ${buildShortDescription(listing)}`,
      channel,
      cta: "Message the agency for availability, viewing slots, and updated ownership costs.",
      hashtags,
      hook: `${listing.title} is ready for a LINE VOOM property spotlight.`,
      label: "LINE VOOM",
      locale,
      status
    };
  }

  if (channel === "facebook") {
    return {
      body: `${listing.title} gives clients a clear ${formatListingType(listing.listingType).toLowerCase()} option in ${market}. ${buildShortDescription(
        listing
      )} ${amenityLine}`,
      channel,
      cta: "Use this draft for a Facebook post with gallery photos and a lead form link.",
      hashtags,
      hook: `${listing.title}: ${priceLine}`,
      label: "Facebook",
      locale,
      status
    };
  }

  return {
    body: `${market} property pick. ${priceLine}. ${amenityLine}`,
    channel,
    cta: "Pair with the cover photo and first three gallery images for carousel publishing.",
    hashtags,
    hook: `${listing.title} in ${market}`,
    label: "Instagram",
    locale,
    status
  };
}

function buildPriceLine(listing: PropertySnapshot) {
  if (listing.listingType === "rent" && listing.rentalPriceMonthly) {
    return `${formatMoney(listing.rentalPriceMonthly)}/month`;
  }

  if (listing.listingType === "sale_or_rent" && listing.rentalPriceMonthly) {
    return `${formatMoney(listing.price)} or ${formatMoney(listing.rentalPriceMonthly)}/month`;
  }

  return formatMoney(listing.price);
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

function formatListingType(value: PropertySnapshot["listingType"]) {
  const labels = {
    rent: "For rent",
    sale: "For sale",
    sale_or_rent: "Sale or rent"
  } satisfies Record<PropertySnapshot["listingType"], string>;

  return labels[value];
}

function formatMoney(value: Money) {
  return new Intl.NumberFormat("en", {
    currency: value.currency,
    maximumFractionDigits: value.amount >= 1_000_000 ? 1 : 0,
    notation: value.amount >= 1_000_000 ? "compact" : "standard",
    style: "currency"
  }).format(value.amount);
}

function formatBucket(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function toHashtag(value: string) {
  const words = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return `#${words.map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`).join("")}`;
}
