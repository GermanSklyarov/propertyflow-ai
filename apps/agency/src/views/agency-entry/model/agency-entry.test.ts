import { describe, expect, it } from "vitest";
import {
  buildAgencyEntryPlanCards,
  buildAgencySignupSummary,
  parseAgencySigninForm,
  parseAgencySignupForm,
  resolveAgencySigninError,
  resolveAgencySignupError,
  resolveSignupPlan,
  toCreateAgencySessionRequest,
  toProvisionTenantRequest
} from "./agency-entry";

describe("agency entry", () => {
  it("builds plan cards that route to signup with the selected plan", () => {
    const cards = buildAgencyEntryPlanCards();

    expect(cards.map((card) => card.id)).toEqual(["starter", "growth", "enterprise"]);
    expect(cards.find((card) => card.id === "starter")).toMatchObject({
      ctaHref: "/signup?plan=starter",
      featured: true,
      primaryUseCase: "Launch an AI Concierge without replacing the agency CRM."
    });
  });

  it("defaults signup to starter when the plan is missing or unsupported", () => {
    expect(resolveSignupPlan(undefined)).toBe("starter");
    expect(resolveSignupPlan("unknown")).toBe("starter");
    expect(resolveSignupPlan(["growth"])).toBe("growth");
  });

  it("summarizes the selected signup plan and next setup steps", () => {
    expect(buildAgencySignupSummary("starter")).toMatchObject({
      planId: "starter",
      planName: "Starter",
      nextSteps: ["Create workspace", "Upload knowledge sources", "Install the AI Concierge widget"]
    });
    expect(buildAgencySignupSummary("growth").nextSteps).toContain("Configure CRM handoff");
  });

  it("maps signup form fields into the tenant provisioning contract", () => {
    const form = new FormData();
    form.set("agencyName", "  Jomtien Homes  ");
    form.set("email", "owner@jomtien.test");
    form.set("website", " https://jomtien.test ");
    form.set("plan", "growth");

    expect(toProvisionTenantRequest(parseAgencySignupForm(form))).toEqual({
      agencyName: "Jomtien Homes",
      subscriptionPlan: "growth",
      website: "https://jomtien.test",
      workEmail: "owner@jomtien.test"
    });
  });

  it("renders friendly signup errors from query codes", () => {
    expect(resolveAgencySignupError("workspace-exists")).toContain("already exists");
    expect(resolveAgencySignupError("provision-failed")).toContain("could not create");
    expect(resolveAgencySignupError("unknown")).toBeNull();
  });

  it("maps signin form fields into the agency session contract", () => {
    const form = new FormData();
    form.set("bootstrapCode", " secret ");
    form.set("email", " OWNER@Jomtien.Test ");
    form.set("tenantSlug", " jomtien-homes ");

    expect(toCreateAgencySessionRequest(parseAgencySigninForm(form))).toEqual({
      bootstrapCode: "secret",
      tenantSlug: "jomtien-homes",
      workEmail: "OWNER@Jomtien.Test"
    });
  });

  it("renders friendly signin errors from query codes", () => {
    expect(resolveAgencySigninError("session-forbidden")).toContain("bootstrap code");
    expect(resolveAgencySigninError("session-failed")).toContain("could not create");
    expect(resolveAgencySigninError("session-required")).toContain("Sign in");
    expect(resolveAgencySigninError("unknown")).toBeNull();
  });
});
