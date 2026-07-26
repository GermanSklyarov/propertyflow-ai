import { SetMetadata } from "@nestjs/common";
import type { TenantSubscriptionPlan } from "@propertyflow/contracts";

export const TENANT_PLANS_KEY = "tenant-plans";

export function TenantPlans(...plans: TenantSubscriptionPlan[]) {
  return SetMetadata(TENANT_PLANS_KEY, plans);
}
