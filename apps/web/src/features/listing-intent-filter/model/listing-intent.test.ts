import { describe, expect, it } from "vitest";
import { demoProperties } from "@entities/property/model/demo-properties";
import {
  countPropertiesByIntent,
  filterPropertiesByIntent,
  getRentalBudgetBand,
  listingIntentCopy,
  parseListingIntent
} from "./listing-intent";

describe("parseListingIntent", () => {
  it("accepts supported listing intent values", () => {
    expect(parseListingIntent("sale")).toBe("sale");
    expect(parseListingIntent("rent")).toBe("rent");
    expect(parseListingIntent("sale_or_rent")).toBe("sale_or_rent");
  });

  it("uses the first value when Next searchParams provides an array", () => {
    expect(parseListingIntent(["rent", "sale"])).toBe("rent");
  });

  it("falls back to all for empty, missing, or unsupported values", () => {
    expect(parseListingIntent(undefined)).toBe("all");
    expect(parseListingIntent(null)).toBe("all");
    expect(parseListingIntent("")).toBe("all");
    expect(parseListingIntent("villa")).toBe("all");
  });
});

describe("filterPropertiesByIntent", () => {
  it("includes dual listings in buy and rent modes", () => {
    expect(filterPropertiesByIntent(demoProperties, "sale").map((property) => property.id)).toEqual([
      "demo-wongamat-sky",
      "demo-jomtien-family"
    ]);
    expect(filterPropertiesByIntent(demoProperties, "rent").map((property) => property.id)).toEqual([
      "demo-wongamat-sky",
      "demo-terminal-north"
    ]);
  });

  it("counts listings with the same intent rules used by filtering", () => {
    expect(countPropertiesByIntent(demoProperties, "all")).toBe(3);
    expect(countPropertiesByIntent(demoProperties, "sale")).toBe(2);
    expect(countPropertiesByIntent(demoProperties, "rent")).toBe(2);
    expect(countPropertiesByIntent(demoProperties, "sale_or_rent")).toBe(1);
  });
});

describe("getRentalBudgetBand", () => {
  it("returns the monthly rental price range when rental prices are available", () => {
    expect(getRentalBudgetBand(demoProperties)).toEqual({ min: 22000, max: 26000 });
  });

  it("returns undefined when no rental prices are published", () => {
    expect(getRentalBudgetBand([demoProperties[2]])).toBeUndefined();
  });
});

describe("listingIntentCopy", () => {
  it("returns stable copy for every listing intent", () => {
    expect(listingIntentCopy("all")).toContain("Switch between purchase and rental intent");
    expect(listingIntentCopy("sale")).toContain("Buy mode");
    expect(listingIntentCopy("rent")).toContain("Rental mode");
    expect(listingIntentCopy("sale_or_rent")).toContain("Dual listings");
  });
});
