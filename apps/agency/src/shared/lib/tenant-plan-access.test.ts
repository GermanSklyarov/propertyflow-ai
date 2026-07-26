import { describe, expect, it } from "vitest";
import { buildPlanAccessMessage, canAccessTenantPlan, crmTenantPlans } from "./tenant-plan-access";

describe("tenant plan access", () => {
  it("keeps CRM routes outside Starter while allowing Growth and Enterprise", () => {
    expect(canAccessTenantPlan("starter", crmTenantPlans)).toBe(false);
    expect(canAccessTenantPlan("growth", crmTenantPlans)).toBe(true);
    expect(canAccessTenantPlan("enterprise", crmTenantPlans)).toBe(true);
  });

  it("explains upgrade boundaries without presenting them as broken pages", () => {
    expect(buildPlanAccessMessage("Lead queue")).toContain("Lead queue is available on Growth and Enterprise");
  });
});
