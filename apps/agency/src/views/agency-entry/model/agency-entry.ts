import { tenantPlanCatalog, type TenantSubscriptionPlan } from "@propertyflow/contracts";

export interface AgencyEntryPlanCard {
  ctaHref: string;
  ctaLabel: string;
  description: string;
  featured: boolean;
  id: TenantSubscriptionPlan;
  name: string;
  primaryUseCase: string;
  unlocks: string[];
}

export interface AgencySignupSummary {
  planId: TenantSubscriptionPlan;
  planName: string;
  positioning: string;
  nextSteps: string[];
}

const planUseCases: Record<TenantSubscriptionPlan, string> = {
  starter: "Launch an AI Concierge without replacing the agency CRM.",
  growth: "Turn qualified Concierge conversations into assigned lead work.",
  enterprise: "Run multi-team CRM, automation, analytics, and integrations."
};

const planUnlocks: Record<TenantSubscriptionPlan, string[]> = {
  starter: ["Knowledge Base", "Website widget", "Listing sources", "Localized AI"],
  growth: ["Lead handoff", "Agent assignment", "Pipeline follow-up", "Public API"],
  enterprise: ["Advanced roles", "SLA controls", "Automation", "Custom limits"]
};

export function buildAgencyEntryPlanCards(): AgencyEntryPlanCard[] {
  return (["starter", "growth", "enterprise"] as const).map((planId) => {
    const plan = tenantPlanCatalog[planId];

    return {
      ctaHref: `/signup?plan=${plan.id}`,
      ctaLabel: plan.id === "enterprise" ? "Talk to sales" : `Start ${plan.name}`,
      description: plan.positioning,
      featured: plan.id === "starter",
      id: plan.id,
      name: plan.name,
      primaryUseCase: planUseCases[plan.id],
      unlocks: planUnlocks[plan.id]
    };
  });
}

export function resolveSignupPlan(plan: string | string[] | undefined): TenantSubscriptionPlan {
  const value = Array.isArray(plan) ? plan[0] : plan;

  return value === "growth" || value === "enterprise" ? value : "starter";
}

export function buildAgencySignupSummary(planId: TenantSubscriptionPlan): AgencySignupSummary {
  const plan = tenantPlanCatalog[planId];

  return {
    planId: plan.id,
    planName: plan.name,
    positioning: plan.positioning,
    nextSteps:
      plan.id === "starter"
        ? ["Create workspace", "Upload knowledge sources", "Install the AI Concierge widget"]
        : ["Create workspace", "Confirm upgrade scope", "Configure CRM handoff"]
  };
}
