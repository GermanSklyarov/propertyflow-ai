import { describe, expect, it } from "vitest";
import { formatBucket, formatDate, formatDateTime, formatNumber, formatPercent } from "./formatters";

describe("agency formatters", () => {
  it("formats fractions and backend percentage values without double multiplication", () => {
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(100)).toBe("100%");
    expect(formatPercent(0.18)).toBe("18%");
    expect(formatPercent(18)).toBe("18%");
    expect(formatPercent(7.14, { maximumFractionDigits: 1 })).toBe("7.1%");
  });

  it("formats stable UTC dates and date-times", () => {
    expect(formatDate("2026-07-12T01:18:10.000Z")).toBe("Jul 12, 2026");
    expect(formatDateTime("2026-07-12T01:18:10.000Z")).toBe("Jul 12, 01:18 AM");
  });

  it("formats numbers and buckets for compact UI labels", () => {
    expect(formatNumber(50000)).toBe("50,000");
    expect(formatBucket("saved-search_lead")).toBe("saved search lead");
  });
});
