import { describe, expect, it } from "vitest";
import { demoProperties } from "./demo-properties";
import { buildMarketSnapshot } from "./market-snapshot";

describe("buildMarketSnapshot", () => {
  it("builds hero and surface metrics from available properties", () => {
    const snapshot = buildMarketSnapshot(demoProperties);

    expect(snapshot.heroMetrics).toEqual([
      { label: "Curated matches", value: "3+" },
      { label: "Top yield signal", value: "7.8%" },
      { label: "Walkability fit", value: "4.2/5" }
    ]);
    expect(snapshot.surfaceMetrics).toEqual([
      { label: "Primary market", value: "pattaya" },
      { label: "Rent-ready", value: "2" },
      { label: "Buy-ready", value: "2" }
    ]);
  });

  it("falls back for an empty market snapshot", () => {
    const snapshot = buildMarketSnapshot([]);

    expect(snapshot.heroMetrics[1]).toEqual({ label: "Top yield signal", value: "Pending" });
    expect(snapshot.heroMetrics[2]).toEqual({ label: "Walkability fit", value: "0.0/5" });
    expect(snapshot.surfaceMetrics[0]).toEqual({ label: "Primary market", value: "Thailand" });
  });
});
