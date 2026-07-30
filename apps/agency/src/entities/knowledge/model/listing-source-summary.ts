import type { ListingSourceCanonicalField, ListingSourceSnapshot } from "@propertyflow/contracts";

const requiredConciergeFields: ListingSourceCanonicalField[] = ["title", "market", "listingType", "status"];
const usefulPriceFields: ListingSourceCanonicalField[] = ["priceAmount", "rentalPriceMonthlyAmount"];
const availabilityCanonicalFields: ListingSourceCanonicalField[] = ["availableFrom", "availableUntil", "minimumRentalMonths"];

const canonicalLabels: Record<ListingSourceCanonicalField, string> = {
  address: "Address",
  amenities: "Amenities",
  areaSqm: "Area",
  availableFrom: "Available from",
  availableUntil: "Available until",
  bathrooms: "Bathrooms",
  bedrooms: "Bedrooms",
  description: "Description",
  developerName: "Developer",
  externalId: "External ID",
  floor: "Floor",
  foreignQuota: "Foreign quota",
  imageUrls: "Images",
  kind: "Property type",
  latitude: "Latitude",
  listingType: "Sale/rent",
  longitude: "Longitude",
  maintenanceFee: "Maintenance fee",
  market: "Market",
  minimumRentalMonths: "Minimum rental term",
  priceAmount: "Sale price",
  priceCurrency: "Currency",
  projectName: "Project",
  rentalPriceMonthlyAmount: "Monthly rent",
  status: "Status",
  title: "Title"
};

export interface ListingSourceSummary {
  availabilitySignals: string[];
  canonicalCount: number;
  customAttributeCount: number;
  mappedCanonicalFields: string[];
  missingProductionFields: string[];
  readinessLabel: string;
  searchableCustomAttributeCount: number;
  searchableCustomAttributes: string[];
  syncLabel: string;
}

export function buildListingSourceSummary(source: ListingSourceSnapshot): ListingSourceSummary {
  const mappedCanonicalEntries = Object.entries(source.mapping.canonical).filter(([, sourcePath]) => hasSourcePath(sourcePath));
  const mappedCanonicalFields = mappedCanonicalEntries.map(([field]) => canonicalLabels[field as ListingSourceCanonicalField] ?? field);
  const customAttributes = source.mapping.customAttributes ?? [];
  const searchableCustomAttributes = customAttributes
    .filter((attribute) => attribute.searchable !== false)
    .map((attribute) => attribute.label ?? attribute.key);
  const missingRequiredFields = requiredConciergeFields.filter((field) => !hasSourcePath(source.mapping.canonical[field]));
  const hasPriceSignal = usefulPriceFields.some((field) => hasSourcePath(source.mapping.canonical[field]));
  const availabilitySignals = [
    ...availabilityCanonicalFields
      .filter((field) => hasSourcePath(source.mapping.canonical[field]))
      .map((field) => canonicalLabels[field]),
    ...customAttributes
      .filter((attribute) => attribute.searchable !== false && isAvailabilityHint(attribute.filterHint))
      .map((attribute) => attribute.label ?? attribute.key)
  ];
  const missingProductionFields = [
    ...missingRequiredFields.map((field) => canonicalLabels[field]),
    ...(hasPriceSignal ? [] : ["Sale or rent price"]),
    ...(availabilitySignals.length ? [] : ["Availability or lease term"])
  ];

  return {
    availabilitySignals,
    canonicalCount: mappedCanonicalEntries.length,
    customAttributeCount: customAttributes.length,
    mappedCanonicalFields,
    missingProductionFields,
    readinessLabel: buildReadinessLabel(source, missingProductionFields),
    searchableCustomAttributeCount: searchableCustomAttributes.length,
    searchableCustomAttributes,
    syncLabel: source.lastSyncAt ? `Last sync ${formatSyncDate(source.lastSyncAt)}` : "No completed sync yet"
  };
}

function hasSourcePath(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isAvailabilityHint(value: unknown) {
  return value === "availability" || value === "contract_term";
}

function buildReadinessLabel(source: ListingSourceSnapshot, missingProductionFields: string[]) {
  if (source.status === "failed") {
    return "Fix sync before production";
  }
  if (source.status === "syncing") {
    return "Sync in progress";
  }
  if (missingProductionFields.length) {
    return `${missingProductionFields.length} production gaps`;
  }

  return "Concierge-ready";
}

function formatSyncDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(value));
}
