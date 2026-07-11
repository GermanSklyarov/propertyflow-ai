import { describe, expect, it } from "vitest";
import { demoProperties } from "./demo-properties";
import { buildPropertyBrief, getBeachScore, getGrossYield } from "./property-brief";

describe("buildPropertyBrief", () => {
  it("summarizes a dual sale-or-rent listing with investment signals", () => {
    const brief = buildPropertyBrief(demoProperties[0]);

    expect(brief.listingLabel).toBe("Sale or rent");
    expect(brief.primaryPrice).toContain("or");
    expect(brief.primaryPrice).toContain("/mo");
    expect(brief.grossYield).toBeCloseTo(7.75, 2);
    expect(brief.annualRentSignal).toBe(252000);
    expect(brief.beachScore).toBe(5);
    expect(brief.remoteWorkScore).toBe(5);
    expect(brief.neighborhoodRows.map((row) => row.label)).toEqual([
      "Beach",
      "Restaurants",
      "Remote work",
      "Quiet living",
      "Shopping",
      "Nightlife"
    ]);
    expect(brief.tradeoffs[0]).toContain("High floor");
  });

  it("uses rental-specific copy and questions for rent listings", () => {
    const brief = buildPropertyBrief(demoProperties[1]);

    expect(brief.listingLabel).toBe("For rent");
    expect(brief.primaryPrice).toContain("/mo");
    expect(brief.summaryTitle).toContain("short-stay");
    expect(brief.questions[0]).toContain("lease length");
    expect(brief.beachScore).toBe(4);
    expect(brief.neighborhoodRows.find((row) => row.label === "Shopping")?.value).toBe(5);
    expect(brief.neighborhoodRows.find((row) => row.label === "Nightlife")?.value).toBe(4);
  });

  it("highlights quieter Jomtien lifestyle fit for family sale listings", () => {
    const brief = buildPropertyBrief(demoProperties[2]);

    expect(brief.listingLabel).toBe("For sale");
    expect(brief.quietLivingScore).toBe(5);
    expect(brief.remoteWorkScore).toBe(3);
    expect(brief.pros[0]).toContain("Beach access");
    expect(brief.neighborhoodRows.find((row) => row.label === "Quiet living")?.value).toBe(5);
    expect(brief.neighborhoodRows.find((row) => row.label === "Nightlife")?.value).toBe(3);
    expect(brief.questions[0]).toContain("transfer fees");
  });
});

describe("property brief calculations", () => {
  it("does not return yield when purchase price cannot be used", () => {
    expect(
      getGrossYield({
        ...demoProperties[0],
        price: { amount: 0, currency: "THB" }
      })
    ).toBeUndefined();
  });

  it("falls back to a neutral beach score when distance is missing", () => {
    expect(
      getBeachScore({
        ...demoProperties[0],
        beachDistanceMeters: undefined
      })
    ).toBe(3);
  });
});
