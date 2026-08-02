export const listingImportTemplateColumns = [
  "externalId",
  "title",
  "description",
  "kind",
  "listingType",
  "market",
  "status",
  "priceThb",
  "priceCurrency",
  "rentalPriceMonthlyThb",
  "areaSqm",
  "bedrooms",
  "bathrooms",
  "floor",
  "address",
  "latitude",
  "longitude",
  "projectName",
  "projectStatus",
  "projectDeveloper",
  "amenities",
  "imageUrls",
  "availableFrom",
  "availableUntil",
  "minimumRentalMonths",
  "foreignQuota",
  "maintenanceFeeMonthlyThb"
] as const;

export type ListingImportTemplateColumn = (typeof listingImportTemplateColumns)[number];

export type ListingImportColumnImportance = "required" | "recommended" | "optional";

export const listingImportColumnLabels: Record<ListingImportTemplateColumn, string> = {
  address: "Address",
  amenities: "Amenities",
  areaSqm: "Area, sqm",
  availableFrom: "Available from",
  availableUntil: "Available until",
  bathrooms: "Bathrooms",
  bedrooms: "Bedrooms",
  description: "Description",
  externalId: "External ID",
  floor: "Floor",
  foreignQuota: "Foreign quota",
  imageUrls: "Image URLs",
  kind: "Property kind",
  latitude: "Latitude",
  listingType: "Sale / rent",
  longitude: "Longitude",
  maintenanceFeeMonthlyThb: "Maintenance fee",
  market: "Market / city",
  minimumRentalMonths: "Minimum rental months",
  priceCurrency: "Currency",
  priceThb: "Sale price",
  projectDeveloper: "Project developer",
  projectName: "Project name",
  projectStatus: "Project status",
  rentalPriceMonthlyThb: "Monthly rent",
  status: "Listing status",
  title: "Title"
};

const requiredListingImportColumns = new Set<ListingImportTemplateColumn>(["title"]);

const recommendedListingImportColumns = new Set<ListingImportTemplateColumn>([
  "address",
  "amenities",
  "areaSqm",
  "availableUntil",
  "bathrooms",
  "bedrooms",
  "description",
  "externalId",
  "imageUrls",
  "kind",
  "listingType",
  "market",
  "minimumRentalMonths",
  "priceThb",
  "projectName",
  "rentalPriceMonthlyThb"
]);

export const listingImportColumnSynonyms: Record<ListingImportTemplateColumn, string[]> = {
  address: ["address", "location_address", "street", "landmark"],
  amenities: ["amenities", "features", "facilities", "tags"],
  areaSqm: ["areasqm", "area_sqm", "area", "sqm", "size", "size_sqm"],
  availableFrom: ["availablefrom", "available_from", "available_start", "rent_available_from", "lease_start"],
  availableUntil: ["availableuntil", "available_until", "available_end", "rent_available_until", "lease_end"],
  bathrooms: ["bathrooms", "baths", "bath"],
  bedrooms: ["bedrooms", "beds", "bed"],
  description: ["description", "details", "notes", "agent_note", "remark"],
  externalId: ["externalid", "external_id", "sourceid", "source_id", "listingid", "listing_id", "reference", "ref", "crm_id"],
  floor: ["floor", "level", "unit_floor"],
  foreignQuota: ["foreignquota", "foreign_quota", "quota", "ownership_quota"],
  imageUrls: ["imageurls", "image_urls", "images", "photos", "photo_urls", "gallery"],
  kind: ["kind", "type", "property_type", "asset_type", "category"],
  latitude: ["latitude", "lat"],
  listingType: ["listingtype", "listing_type", "intent", "transaction", "deal_type", "offer_type"],
  longitude: ["longitude", "lng", "lon"],
  maintenanceFeeMonthlyThb: [
    "maintenancefeemonthlythb",
    "maintenance_fee_monthly_thb",
    "maintenance_fee",
    "maintenance",
    "common_fee",
    "cam_fee"
  ],
  market: ["market", "city", "area", "location", "province", "destination"],
  minimumRentalMonths: ["minimumrentalmonths", "minimum_rental_months", "min_rental_months", "minimum_stay", "lease_term"],
  priceCurrency: ["pricecurrency", "price_currency", "currency"],
  priceThb: ["pricethb", "price_thb", "price", "sale_price", "asking_price", "purchase_price"],
  projectDeveloper: ["projectdeveloper", "project_developer", "developer", "developer_name"],
  projectName: ["projectname", "project_name", "project", "development", "compound", "village"],
  projectStatus: ["projectstatus", "project_status", "construction_status", "completion_status"],
  rentalPriceMonthlyThb: ["rentalpricemonthlythb", "rental_price_monthly_thb", "monthly_rent", "rent", "rental_price"],
  status: ["status", "availability", "listing_status"],
  title: ["title", "name", "property_name", "listing_title", "unit_name"]
};

export function getListingImportColumnImportance(column: string): ListingImportColumnImportance {
  const canonicalColumn = column as ListingImportTemplateColumn;

  if (requiredListingImportColumns.has(canonicalColumn)) {
    return "required";
  }

  if (recommendedListingImportColumns.has(canonicalColumn)) {
    return "recommended";
  }

  return "optional";
}

export function getListingImportColumnLabel(column: string) {
  return listingImportColumnLabels[column as ListingImportTemplateColumn] ?? column;
}

export function buildListingImportColumnMapping(columns: readonly string[], headers: readonly string[]) {
  const normalizedHeaderByHeader = new Map(headers.map((header) => [normalizeListingImportHeader(header), header]));

  return Object.fromEntries(
    columns
      .map((column) => {
        const match = listingImportColumnSynonyms[column as ListingImportTemplateColumn]?.find((candidate) =>
          normalizedHeaderByHeader.has(candidate)
        );

        return match ? [column, normalizedHeaderByHeader.get(match)!] : undefined;
      })
      .filter((entry): entry is [string, string] => Boolean(entry))
  );
}

export function parseListingImportHeaderRow(csv: string) {
  const row: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      row.push(currentCell.trim());
      return row.filter(Boolean);
    }

    currentCell += char;
  }

  row.push(currentCell.trim());

  return row.filter(Boolean);
}

function normalizeListingImportHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
}
