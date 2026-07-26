import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { TenantSnapshot, TenantSubscriptionPlan } from "@propertyflow/contracts";
import { TENANT_PLANS_KEY } from "./tenant-plan.decorator.js";
import { TenantPlanGuard } from "./tenant-plan.guard.js";

const tenant = (subscriptionPlan: TenantSubscriptionPlan): TenantSnapshot =>
  ({
    createdAt: new Date().toISOString(),
    id: "tenant-1",
    name: "Tenant 1",
    slug: "tenant-1",
    status: "active",
    subscriptionPlan,
    updatedAt: new Date().toISOString(),
    widget: {}
  }) as TenantSnapshot;

describe("TenantPlanGuard", () => {
  it("allows requests when no route plan metadata is configured", () => {
    const guard = createGuard(undefined);

    expect(guard.canActivate(createContext({ tenant: tenant("starter") }))).toBe(true);
  });

  it("allows tenants on an enabled plan", () => {
    const guard = createGuard(["growth", "enterprise"]);

    expect(guard.canActivate(createContext({ tenant: tenant("growth") }))).toBe(true);
  });

  it("rejects tenants below the required plan", () => {
    const guard = createGuard(["growth", "enterprise"]);

    expect(() => guard.canActivate(createContext({ tenant: tenant("starter") }))).toThrow(ForbiddenException);
  });

  it("rejects requests before tenant context is attached", () => {
    const guard = createGuard(["growth", "enterprise"]);

    expect(() => guard.canActivate(createContext({}))).toThrow(ForbiddenException);
  });
});

function createGuard(requiredPlans: TenantSubscriptionPlan[] | undefined) {
  return new TenantPlanGuard({
    getAllAndOverride: vi.fn((key: string) => (key === TENANT_PLANS_KEY ? requiredPlans : undefined))
  } as never);
}

function createContext(request: object) {
  return {
    getClass: () => TenantPlanGuard,
    getHandler: () => createContext,
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as never;
}
