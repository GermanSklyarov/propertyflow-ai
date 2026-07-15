import { describe, expect, it } from "vitest";
import { buildAmenitySuggestions, normalizeAmenityLabel } from "./amenity-suggestions.js";

describe("amenity suggestions", () => {
  it("normalizes common amenity aliases", () => {
    expect(normalizeAmenityLabel("Wi-Fi")).toBe("wifi");
    expect(normalizeAmenityLabel("fitness centre")).toBe("gym");
    expect(normalizeAmenityLabel("Swimming Pool")).toBe("swimming pool");
    expect(normalizeAmenityLabel("24/7 Security")).toBe("security");
  });

  it("deduplicates listing and project amenities by normalized label", () => {
    const result = buildAmenitySuggestions(
      [
        { label: "Pool", source: "listing" },
        { label: "Swimming Pool", source: "project" },
        { label: "Wi-Fi", source: "listing" },
        { label: "wifi", source: "project" },
        { label: "Gym", source: "project" }
      ],
      { limit: 10 }
    );

    expect(result.items).toEqual([
      {
        count: 2,
        label: "Pool",
        normalized: "swimming pool",
        sources: ["listing", "project"]
      },
      {
        count: 2,
        label: "wifi",
        normalized: "wifi",
        sources: ["listing", "project"]
      },
      {
        count: 1,
        label: "Gym",
        normalized: "gym",
        sources: ["project"]
      }
    ]);
  });

  it("filters by the current typed token", () => {
    const result = buildAmenitySuggestions(
      [
        { label: "pool", source: "listing" },
        { label: "parking", source: "listing" },
        { label: "coworking", source: "project" }
      ],
      { query: "park", limit: 10 }
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.normalized).toBe("parking");
  });
});
