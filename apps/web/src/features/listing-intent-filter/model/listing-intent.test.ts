import { describe, expect, it } from "vitest";
import { parseListingIntent } from "./listing-intent";

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
