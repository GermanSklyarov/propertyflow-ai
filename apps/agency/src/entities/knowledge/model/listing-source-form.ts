import type { CreateListingSourceRequest } from "@propertyflow/contracts";

export const DEFAULT_LISTING_CANONICAL_MAPPING = `{
  "externalId": "id",
  "title": "name",
  "description": "description",
  "kind": "property_type",
  "listingType": "deal_type",
  "market": "city",
  "status": "status",
  "priceAmount": "sale_price",
  "priceCurrency": "currency",
  "rentalPriceMonthlyAmount": "monthly_rent",
  "bedrooms": "bedrooms",
  "bathrooms": "bathrooms",
  "areaSqm": "area_sqm",
  "address": "address",
  "projectName": "project_name",
  "amenities": "amenities",
  "imageUrls": "images",
  "availableUntil": "rent_available_until",
  "minimumRentalMonths": "minimum_rental_months"
}`;

export const DEFAULT_LISTING_CUSTOM_ATTRIBUTES = `[
  {
    "key": "lease_available_until",
    "sourcePath": "rent_available_until",
    "type": "date",
    "label": "Rent available until",
    "description": "Do not recommend this listing for stays that end after this date.",
    "filterHint": "availability",
    "searchable": true
  },
  {
    "key": "view_quality",
    "sourcePath": "view_note",
    "type": "text",
    "label": "View quality",
    "filterHint": "view",
    "searchable": true
  }
]`;

type ParseResult<T> = { ok: true; value: T } | { message: string; ok: false };

type CanonicalMapping = CreateListingSourceRequest["mapping"]["canonical"];
type CustomAttributeMapping = NonNullable<CreateListingSourceRequest["mapping"]["customAttributes"]>[number];
type CustomAttributeMappings = NonNullable<CreateListingSourceRequest["mapping"]["customAttributes"]>;
type CustomAttributeFilterHint = NonNullable<CustomAttributeMapping["filterHint"]>;

const allowedCustomAttributeTypes = new Set(["boolean", "date", "enum", "json", "number", "text"]);
const allowedCustomAttributeFilterHints = new Set([
  "amenity",
  "availability",
  "contract_term",
  "fee",
  "other",
  "ownership",
  "restriction",
  "view"
]);

export function parseListingSourceCanonicalMappingDraft(value: unknown): ParseResult<CanonicalMapping> {
  const parsed = parseJsonObject(value, "Canonical mapping");

  if (!parsed.ok) {
    return parsed;
  }

  const mapping = Object.fromEntries(
    Object.entries(parsed.value).filter(([, sourcePath]) => typeof sourcePath === "string" && sourcePath.trim().length > 0)
  ) as CanonicalMapping;

  if (!mapping.title || !mapping.market) {
    return {
      message: "Canonical mapping must include at least title and market source paths.",
      ok: false
    };
  }

  return { ok: true, value: mapping };
}

export function parseListingSourceCustomAttributesDraft(value: unknown): ParseResult<CustomAttributeMappings> {
  const rawValue = typeof value === "string" ? value.trim() : "";

  if (!rawValue) {
    return { ok: true, value: [] };
  }

  const parsed = parseJson(rawValue, "Custom searchable attributes");

  if (!parsed.ok) {
    return parsed;
  }

  if (!Array.isArray(parsed.value)) {
    return {
      message: "Custom searchable attributes must be a JSON array.",
      ok: false
    };
  }

  const attributes: CustomAttributeMappings = [];

  for (const [index, item] of parsed.value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return {
        message: `Custom attribute #${index + 1} must be a JSON object.`,
        ok: false
      };
    }

    const attribute = item as Record<string, unknown>;
    const key = readRequiredString(attribute.key, `Custom attribute #${index + 1} key`);
    const sourcePath = readRequiredString(attribute.sourcePath, `Custom attribute #${index + 1} sourcePath`);
    const type = readRequiredString(attribute.type, `Custom attribute #${index + 1} type`);

    if (!key.ok) {
      return key;
    }
    if (!sourcePath.ok) {
      return sourcePath;
    }
    if (!type.ok) {
      return type;
    }
    if (!allowedCustomAttributeTypes.has(type.value)) {
      return {
        message: `Custom attribute #${index + 1} type must be boolean, date, enum, json, number, or text.`,
        ok: false
      };
    }

    attributes.push({
      description: readOptionalString(attribute.description),
      filterHint: readOptionalFilterHint(attribute.filterHint),
      key: key.value,
      label: readOptionalString(attribute.label),
      searchable: attribute.searchable !== false,
      sourcePath: sourcePath.value,
      type: type.value as CustomAttributeMapping["type"]
    });
  }

  return { ok: true, value: attributes };
}

function parseJsonObject(value: unknown, label: string): ParseResult<Record<string, unknown>> {
  const parsed = parseJson(typeof value === "string" ? value : "", label);

  if (!parsed.ok) {
    return parsed;
  }

  if (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return {
      message: `${label} must be a JSON object.`,
      ok: false
    };
  }

  return { ok: true, value: parsed.value as Record<string, unknown> };
}

function parseJson(value: string, label: string): ParseResult<unknown> {
  if (!value.trim()) {
    return { ok: true, value: {} };
  }

  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch {
    return {
      message: `${label} contains invalid JSON. Check quotes, commas, and brackets.`,
      ok: false
    };
  }
}

function readRequiredString(value: unknown, label: string): ParseResult<string> {
  if (typeof value !== "string" || !value.trim()) {
    return {
      message: `${label} is required.`,
      ok: false
    };
  }

  return { ok: true, value: value.trim() };
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readOptionalFilterHint(value: unknown): CustomAttributeFilterHint | undefined {
  const hint = readOptionalString(value);

  return hint && allowedCustomAttributeFilterHints.has(hint) ? (hint as CustomAttributeFilterHint) : undefined;
}
