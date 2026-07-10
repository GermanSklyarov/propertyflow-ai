import { describe, expect, it } from "vitest";
import { demoProperties } from "@entities/property/model/demo-properties";
import { buildCompareInsights } from "./compare-insights";

describe("buildCompareInsights", () => {
  it("returns no insights when there are no selected properties", () => {
    expect(buildCompareInsights([])).toEqual([]);
  });

  it("picks category winners from selected property signals", () => {
    const insights = buildCompareInsights(demoProperties);

    expect(insights).toHaveLength(3);
    expect(insights.find((insight) => insight.label === "Investment")?.property.id).toBe("demo-wongamat-sky");
    expect(insights.find((insight) => insight.label === "Winter living")?.property.id).toBe("demo-wongamat-sky");
    expect(insights.find((insight) => insight.label === "Family fit")?.property.id).toBe("demo-jomtien-family");
  });
});
