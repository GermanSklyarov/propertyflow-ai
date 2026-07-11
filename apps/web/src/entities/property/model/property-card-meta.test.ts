import { describe, expect, it } from "vitest";
import { demoProperties } from "./demo-properties";
import { buildPropertyCardMeta, getAmenityLabel, getYieldLabel } from "./property-card-meta";

describe("buildPropertyCardMeta", () => {
  it("builds compact labels for dual sale-or-rent cards", () => {
    const meta = buildPropertyCardMeta(demoProperties[0]);

    expect(meta.listingBadge).toBe("sale/rent · pattaya");
    expect(meta.priceLabel).toContain("·");
    expect(meta.priceLabel).toContain("/mo");
    expect(meta.yieldLabel).toBe("7.8% gross yield");
    expect(meta.matchSignal).toBe("Flexible buy-or-rent strategy");
    expect(meta.scoreChips).toEqual([
      { label: "Beach", value: "5/5" },
      { label: "Remote", value: "5/5" },
      { label: "Quiet", value: "4/5" }
    ]);
  });

  it("uses rental positioning for rent-only cards", () => {
    const meta = buildPropertyCardMeta(demoProperties[1]);

    expect(meta.listingBadge).toBe("rent · pattaya");
    expect(meta.priceLabel).toContain("/mo");
    expect(meta.matchSignal).toContain("Lease-ready");
  });

  it("uses family-oriented signal for larger sale listings", () => {
    const meta = buildPropertyCardMeta(demoProperties[2]);

    expect(meta.listingBadge).toBe("sale · pattaya");
    expect(meta.matchSignal).toBe("Lifestyle-first ownership fit");
    expect(meta.scoreChips.find((chip) => chip.label === "Quiet")?.value).toBe("5/5");
  });
});

describe("property card fallback labels", () => {
  it("falls back when yield or amenities are unavailable", () => {
    const propertyWithoutSignals = {
      ...demoProperties[0],
      amenities: [],
      monthlyRentEstimate: undefined
    };

    expect(getYieldLabel(propertyWithoutSignals)).toBe("Yield pending");
    expect(getAmenityLabel(propertyWithoutSignals)).toBe("Amenities pending");
  });
});
