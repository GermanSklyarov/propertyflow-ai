import { describe, expect, it } from "vitest";
import { buildAgencyEntryPlanCards, buildAgencySignupSummary, resolveSignupPlan } from "./agency-entry";

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
});
