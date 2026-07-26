import type { TenantSubscriptionPlan } from "@propertyflow/contracts";

export const crmTenantPlans: readonly TenantSubscriptionPlan[] = ["growth", "enterprise"];

export function canAccessTenantPlan(
  currentPlan: TenantSubscriptionPlan,
  allowedPlans: readonly TenantSubscriptionPlan[]
): boolean {
  return allowedPlans.includes(currentPlan);
}

export function buildPlanAccessMessage(featureName: string, requiredPlanName = "Growth") {
  return `${featureName} is available on ${requiredPlanName} and Enterprise. Starter stays focused on Knowledge Base, listing sources, and the AI Concierge widget.`;
}
