import { describe, expect, it } from "vitest";
import { demoProperties } from "@entities/property/model/demo-properties";
import { buildFallbackPropertyComparison } from "./property-comparison-fallback";

describe("buildFallbackPropertyComparison", () => {
  it("returns a backend-shaped comparison for selected listings", () => {
    const comparison = buildFallbackPropertyComparison(demoProperties.slice(0, 3));

    expect(comparison.comparedPropertyIds).toHaveLength(3);
    expect(comparison.winners.map((winner) => winner.purpose)).toEqual([
      "investment",
      "living",
      "family",
      "relocation"
    ]);
    expect(comparison.summary).toContain("leads for investment");
  });

  it("limits comparison to three properties", () => {
    const comparison = buildFallbackPropertyComparison(demoProperties);

    expect(comparison.comparedPropertyIds).toHaveLength(3);
  });
});
