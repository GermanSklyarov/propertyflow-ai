import type { ProvisionTenantRequest, RequestAgencyMagicLinkRequest } from "@propertyflow/contracts";
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

export type AgencySignupErrorCode = "workspace-exists" | "provision-failed";

export type AgencySigninErrorCode =
  | "magic-link-failed"
  | "magic-link-invalid"
  | "session-expired"
  | "session-forbidden"
  | "session-failed"
  | "session-required";

export interface AgencySignupFormValues {
  agencyName: string;
  plan: TenantSubscriptionPlan;
  website?: string;
  workEmail: string;
}

export interface AgencySigninFormValues {
  tenantSlug: string;
  workEmail: string;
}

const planUseCases: Record<TenantSubscriptionPlan, string> = {
  starter: "Qualify website visitors with an AI Sales Assistant before agents step in.",
  growth: "Turn qualified AI conversations into assigned CRM follow-up.",
  enterprise: "Run multi-team CRM, automation, analytics, and integrations."
};

const planUnlocks: Record<TenantSubscriptionPlan, string[]> = {
  starter: ["AI Concierge", "Lead qualification", "Listing search", "Conversation history"],
  growth: ["CRM lead capture", "Agent assignment", "Pipeline follow-up", "Public API"],
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
        ? ["Create workspace", "Upload knowledge sources", "Configure lead qualification"]
        : ["Create workspace", "Confirm upgrade scope", "Configure CRM handoff"]
  };
}

export function parseAgencySignupForm(formData: FormData): AgencySignupFormValues {
  return {
    agencyName: readRequiredFormValue(formData, "agencyName"),
    plan: resolveSignupPlan(readRequiredFormValue(formData, "plan")),
    website: readOptionalFormValue(formData, "website"),
    workEmail: readRequiredFormValue(formData, "email")
  };
}

export function toProvisionTenantRequest(values: AgencySignupFormValues): ProvisionTenantRequest {
  return {
    agencyName: values.agencyName,
    subscriptionPlan: values.plan,
    website: values.website,
    workEmail: values.workEmail
  };
}

export function parseAgencySigninForm(formData: FormData): AgencySigninFormValues {
  return {
    tenantSlug: readRequiredFormValue(formData, "tenantSlug"),
    workEmail: readRequiredFormValue(formData, "email")
  };
}

export function toRequestAgencyMagicLinkRequest(values: AgencySigninFormValues): RequestAgencyMagicLinkRequest {
  return {
    tenantSlug: values.tenantSlug,
    workEmail: values.workEmail
  };
}

export function resolveAgencySignupError(error: string | string[] | undefined): string | null {
  const value = Array.isArray(error) ? error[0] : error;

  if (value === "workspace-exists") {
    return "An agency workspace with this name already exists. Try signing in or use a different agency name.";
  }

  if (value === "provision-failed") {
    return "We could not create the workspace. Check the details and try again.";
  }

  return null;
}

export function resolveAgencySigninError(error: string | string[] | undefined): string | null {
  const value = Array.isArray(error) ? error[0] : error;

  if (value === "session-forbidden") {
    return "This workspace cannot accept this sign-in request. Ask the workspace owner for access.";
  }

  if (value === "magic-link-failed") {
    return "We could not send a secure sign-in link. Check the workspace and work email, then try again.";
  }

  if (value === "magic-link-invalid") {
    return "This secure sign-in link is expired or invalid. Request a new link to continue.";
  }

  if (value === "session-failed") {
    return "We could not sign you in. Check the workspace and work email.";
  }

  if (value === "session-required") {
    return "Sign in to continue into the agency workspace.";
  }

  if (value === "session-expired") {
    return "Your agency session expired. Sign in again to continue.";
  }

  return null;
}

function readRequiredFormValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required signup field: ${key}`);
  }

  return value.trim();
}

function readOptionalFormValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
