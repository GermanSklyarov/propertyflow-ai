import { describe, expect, it } from "vitest";
import { demoProperties } from "./demo-properties";
import { buildPropertyEconomics } from "./property-economics";

describe("buildPropertyEconomics", () => {
  it("calculates net yield and payback from rent estimate and holding costs", () => {
    const economics = buildPropertyEconomics(demoProperties[0]);

    expect(economics.operatingReserveMonthly).toBe(2100);
    expect(economics.ownershipMonthlyCost).toBe(4300);
    expect(economics.netMonthlyIncome).toBe(16700);
    expect(economics.netYield).toBeCloseTo(6.17, 2);
    expect(economics.paybackYears).toBeCloseTo(16.22, 2);
    expect(economics.transferCostBuffer).toBe(97500);
  });

  it("does not show purchase transfer buffer for rent listings", () => {
    const economics = buildPropertyEconomics(demoProperties[1]);

    expect(economics.transferCostBuffer).toBeUndefined();
    expect(economics.calculatorRows.find((row) => row.label === "Transfer cost buffer")?.value).toBe("Not needed for rent");
  });

  it("keeps rows pending when rent estimate is unavailable", () => {
    const economics = buildPropertyEconomics({
      ...demoProperties[2],
      monthlyRentEstimate: undefined
    });

    expect(economics.netMonthlyIncome).toBeUndefined();
    expect(economics.netYield).toBeUndefined();
    expect(economics.calculatorRows.find((row) => row.label === "Net yield estimate")?.value).toBe("Pending");
  });
});
