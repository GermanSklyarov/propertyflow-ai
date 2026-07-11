import { describe, expect, it } from "vitest";
import { demoProperties } from "./demo-properties";
import { buildPropertyPriceHistory, getPriceHistoryBars } from "./property-price-history";

describe("buildPropertyPriceHistory", () => {
  it("builds a five-year price trend for a Wongamat listing", () => {
    const history = buildPropertyPriceHistory(demoProperties[0]);

    expect(history.trend).toBe("up");
    expect(history.points.map((point) => point.label)).toEqual(["2021", "2022", "2023", "2024", "2025"]);
    expect(history.points[0]?.value).toBe(2665000);
    expect(history.points.at(-1)?.value).toBe(3250000);
    expect(history.changeLabel).toBe("+22.0% since 2021");
  });

  it("normalizes bar heights against the highest point", () => {
    const bars = getPriceHistoryBars(buildPropertyPriceHistory(demoProperties[2]));

    expect(bars.at(-1)?.heightPercent).toBe(100);
    expect(bars[0]?.heightPercent).toBe(86);
    expect(bars[0]?.valueLabel).toContain("THB");
  });
});
