import { describe, expect, it } from "vitest";
import {
  DEFAULT_LISTING_CANONICAL_MAPPING,
  DEFAULT_LISTING_CUSTOM_ATTRIBUTES,
  parseListingSourceCanonicalMappingDraft,
  parseListingSourceCustomAttributesDraft
} from "./listing-source-form";

describe("listing source form mapping", () => {
  it("parses the default canonical mapping with availability fields", () => {
    const result = parseListingSourceCanonicalMappingDraft(DEFAULT_LISTING_CANONICAL_MAPPING);

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        availableUntil: "rent_available_until",
        market: "city",
        minimumRentalMonths: "minimum_rental_months",
        title: "name"
      })
    });
  });

  it("rejects malformed canonical mapping JSON", () => {
    expect(parseListingSourceCanonicalMappingDraft("{")).toEqual({
      message: "Canonical mapping contains invalid JSON. Check quotes, commas, and brackets.",
      ok: false
    });
  });

  it("requires title and market in canonical mapping", () => {
    expect(parseListingSourceCanonicalMappingDraft('{ "title": "name" }')).toEqual({
      message: "Canonical mapping must include at least title and market source paths.",
      ok: false
    });
  });

  it("parses default custom searchable attributes", () => {
    const result = parseListingSourceCustomAttributesDraft(DEFAULT_LISTING_CUSTOM_ATTRIBUTES);

    expect(result).toEqual({
      ok: true,
      value: [
        expect.objectContaining({
          filterHint: "availability",
          key: "lease_available_until",
          searchable: true,
          sourcePath: "rent_available_until",
          type: "date"
        }),
        expect.objectContaining({
          filterHint: "view",
          key: "view_quality",
          sourcePath: "view_note",
          type: "text"
        })
      ]
    });
  });

  it("rejects custom attributes outside the supported type set", () => {
    expect(
      parseListingSourceCustomAttributesDraft('[{ "key": "lease", "sourcePath": "lease", "type": "object" }]')
    ).toEqual({
      message: "Custom attribute #1 type must be boolean, date, enum, json, number, or text.",
      ok: false
    });
  });
});
