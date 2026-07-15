import type {
  AmenitySuggestion,
  AmenitySuggestionRequest,
  AmenitySuggestionResponse,
  AmenitySuggestionSource
} from "@propertyflow/contracts";

export interface RawAmenitySuggestion {
  label: string;
  source: AmenitySuggestionSource;
}

const amenitySynonyms = new Map<string, string>([
  ["24 hour security", "security"],
  ["24 7 security", "security"],
  ["24 h security", "security"],
  ["24h security", "security"],
  ["24/7 security", "security"],
  ["a c", "air conditioning"],
  ["ac", "air conditioning"],
  ["air con", "air conditioning"],
  ["air conditioning", "air conditioning"],
  ["aircon", "air conditioning"],
  ["car park", "parking"],
  ["car parking", "parking"],
  ["co working", "coworking"],
  ["co working space", "coworking"],
  ["coworking space", "coworking"],
  ["fitness", "gym"],
  ["fitness center", "gym"],
  ["fitness centre", "gym"],
  ["gymnasium", "gym"],
  ["ocean view", "sea view"],
  ["parking space", "parking"],
  ["pool", "swimming pool"],
  ["sea view", "sea view"],
  ["swimming pool", "swimming pool"],
  ["wi fi", "wifi"],
  ["wireless internet", "wifi"]
]);

export function normalizeAmenityLabel(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[/_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return amenitySynonyms.get(normalized) ?? normalized;
}

export function buildAmenitySuggestions(
  rawAmenities: RawAmenitySuggestion[],
  filters: AmenitySuggestionRequest = {}
): AmenitySuggestionResponse {
  const query = filters.query ? normalizeAmenityLabel(filters.query) : "";
  const limit = Math.min(Math.max(filters.limit ?? 12, 1), 50);
  const groups = new Map<
    string,
    {
      count: number;
      labels: Map<string, number>;
      sources: Set<AmenitySuggestionSource>;
    }
  >();

  for (const rawAmenity of rawAmenities) {
    const label = rawAmenity.label.trim();
    const normalized = normalizeAmenityLabel(label);

    if (!label || !normalized) {
      continue;
    }

    if (query && !normalized.includes(query) && !label.toLowerCase().includes(query)) {
      continue;
    }

    const group = groups.get(normalized) ?? {
      count: 0,
      labels: new Map<string, number>(),
      sources: new Set<AmenitySuggestionSource>()
    };

    group.count += 1;
    group.labels.set(label, (group.labels.get(label) ?? 0) + 1);
    group.sources.add(rawAmenity.source);
    groups.set(normalized, group);
  }

  const items = [...groups.entries()]
    .map(([normalized, group]): AmenitySuggestion => ({
      count: group.count,
      label: pickCanonicalLabel(normalized, group.labels),
      normalized,
      sources: [...group.sources].sort()
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);

  return {
    filters,
    items,
    total: groups.size
  };
}

function pickCanonicalLabel(normalized: string, labels: Map<string, number>): string {
  const preferredLabel = [...labels.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].length - right[0].length || left[0].localeCompare(right[0])
  )[0]?.[0];

  return preferredLabel ?? toTitleLabel(normalized);
}

function toTitleLabel(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
