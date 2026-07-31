import type { ListingSourceCanonicalField, ListingSourceSnapshot } from "@propertyflow/contracts";

const requiredConciergeFields: ListingSourceCanonicalField[] = ["title", "market", "listingType", "status"];
const usefulPriceFields: ListingSourceCanonicalField[] = ["priceAmount", "rentalPriceMonthlyAmount"];
const availabilityCanonicalFields: ListingSourceCanonicalField[] = ["availableFrom", "availableUntil", "minimumRentalMonths"];
const signalCoverageChecks = [
  {
    id: "identity",
    label: "Identity",
    checks: [
      { field: "externalId", label: "External ID" },
      { field: "title", label: "Title" },
      { field: "listingType", label: "Sale/rent" },
      { field: "status", label: "Status" }
    ]
  },
  {
    id: "location",
    label: "Location",
    checks: [
      { field: "market", label: "Market" },
      { field: "address", label: "Address" },
      { field: "projectName", label: "Project" },
      { field: "latitude", label: "Latitude" },
      { field: "longitude", label: "Longitude" }
    ]
  },
  {
    id: "pricing",
    label: "Pricing",
    checks: [
      { anyField: usefulPriceFields, label: "Sale or rent price" },
      { field: "priceCurrency", label: "Currency" },
      { field: "maintenanceFee", label: "Maintenance fee", customHint: "fee" }
    ]
  },
  {
    id: "availability",
    label: "Availability",
    checks: [
      { field: "availableFrom", label: "Available from" },
      { field: "availableUntil", label: "Available until", customHint: "availability" },
      { field: "minimumRentalMonths", label: "Minimum term", customHint: "contract_term" },
      { customHint: "restriction", label: "Restrictions" }
    ]
  },
  {
    id: "media",
    label: "Media",
    checks: [
      { field: "imageUrls", label: "Images" },
      { field: "description", label: "Description" },
      { field: "amenities", label: "Amenities", customHint: "amenity" },
      { customHint: "view", label: "View notes" }
    ]
  },
  {
    id: "ownership",
    label: "Ownership",
    checks: [
      { field: "developerName", label: "Developer" },
      { field: "foreignQuota", label: "Foreign quota", customHint: "ownership" }
    ]
  }
] as const;

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
  lastSyncLabel: string;
  mappedCanonicalFields: string[];
  missingProductionFields: string[];
  operationalMessage: string;
  readinessLabel: string;
  searchableCustomAttributeCount: number;
  searchableCustomAttributes: string[];
  statusLabel: string;
  statusTone: "muted" | "ready" | "warning" | "working";
  syncButtonDisabled: boolean;
  syncButtonLabel: string;
  syncLabel: string;
  signalCoverage: ListingSourceSignalCoverage[];
}

export interface ListingSourceSignalCoverage {
  id: string;
  covered: number;
  label: string;
  missing: string[];
  summary: string;
  tone: "ready" | "warning";
  total: number;
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
    lastSyncLabel: buildLastSyncLabel(source),
    mappedCanonicalFields,
    missingProductionFields,
    operationalMessage: buildOperationalMessage(source),
    readinessLabel: buildReadinessLabel(source, missingProductionFields),
    searchableCustomAttributeCount: searchableCustomAttributes.length,
    searchableCustomAttributes,
    statusLabel: buildStatusLabel(source),
    statusTone: buildStatusTone(source),
    syncButtonDisabled: source.status === "syncing" || source.status === "disabled",
    syncButtonLabel: buildSyncButtonLabel(source),
    syncLabel: source.lastSyncAt ? `Last sync ${formatSyncDate(source.lastSyncAt)}` : "No completed sync yet",
    signalCoverage: buildSignalCoverage(source)
  };
}

function hasSourcePath(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isAvailabilityHint(value: unknown) {
  return value === "availability" || value === "contract_term";
}

function hasCustomHint(source: ListingSourceSnapshot, hint: NonNullable<ListingSourceSnapshot["mapping"]["customAttributes"]>[number]["filterHint"]) {
  return (source.mapping.customAttributes ?? []).some(
    (attribute) => attribute.searchable !== false && attribute.filterHint === hint && hasSourcePath(attribute.sourcePath)
  );
}

function buildSignalCoverage(source: ListingSourceSnapshot): ListingSourceSignalCoverage[] {
  return signalCoverageChecks.map((group) => {
    const missing = group.checks
      .filter((check) => !isSignalCovered(source, check))
      .map((check) => check.label);
    const covered = group.checks.length - missing.length;

    return {
      id: group.id,
      covered,
      label: group.label,
      missing,
      summary: missing.length ? `Missing ${missing.slice(0, 2).join(", ")}${missing.length > 2 ? "..." : ""}` : "Ready for Concierge",
      tone: missing.length ? "warning" : "ready",
      total: group.checks.length
    };
  });
}

function isSignalCovered(
  source: ListingSourceSnapshot,
  check: {
    anyField?: readonly ListingSourceCanonicalField[];
    customHint?: NonNullable<ListingSourceSnapshot["mapping"]["customAttributes"]>[number]["filterHint"];
    field?: ListingSourceCanonicalField;
  }
) {
  const hasCanonical = check.anyField
    ? check.anyField.some((field) => hasSourcePath(source.mapping.canonical[field]))
    : check.field
      ? hasSourcePath(source.mapping.canonical[check.field])
      : false;

  return hasCanonical || (check.customHint ? hasCustomHint(source, check.customHint) : false);
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

function buildStatusLabel(source: ListingSourceSnapshot) {
  const labels = {
    connected: "Connected",
    disabled: "Disabled",
    draft: "Draft",
    failed: "Sync failed",
    syncing: "Syncing now"
  } satisfies Record<ListingSourceSnapshot["status"], string>;

  return labels[source.status];
}

function buildStatusTone(source: ListingSourceSnapshot): ListingSourceSummary["statusTone"] {
  if (source.status === "connected") {
    return "ready";
  }
  if (source.status === "failed") {
    return "warning";
  }
  if (source.status === "syncing") {
    return "working";
  }

  return "muted";
}

function buildOperationalMessage(source: ListingSourceSnapshot) {
  if (source.status === "syncing") {
    return "Worker is importing mapped fields and refreshing Concierge search context.";
  }
  if (source.status === "failed") {
    return "Fix the endpoint, auth, or mapping, then retry the feed sync.";
  }
  if (source.status === "connected") {
    return "Feed is available for Concierge listing answers and can be refreshed on demand.";
  }
  if (source.status === "disabled") {
    return "Feed is disabled and will not update Concierge listing knowledge.";
  }

  return "Run the first sync after the endpoint and field mapping are ready.";
}

function buildSyncButtonLabel(source: ListingSourceSnapshot) {
  if (source.status === "syncing") {
    return "Syncing...";
  }
  if (source.status === "failed") {
    return "Retry sync";
  }
  if (source.lastSyncAt) {
    return "Refresh feed";
  }

  return "Sync feed";
}

function buildLastSyncLabel(source: ListingSourceSnapshot) {
  if (source.status === "syncing") {
    return source.lastSyncAt ? `Last completed ${formatSyncDate(source.lastSyncAt)}` : "First sync is running";
  }

  return source.lastSyncAt ? `Last completed ${formatSyncDate(source.lastSyncAt)}` : "No completed sync yet";
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
