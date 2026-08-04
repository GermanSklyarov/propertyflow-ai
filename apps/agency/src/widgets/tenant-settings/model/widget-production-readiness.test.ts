import { describe, expect, it } from "vitest";
import type { PublicWidgetAskResponse, TenantWidgetInstallCheckResponse } from "@propertyflow/contracts";
import { summarizeConciergeAnswerCheck } from "./concierge-answer-check";
import { buildWidgetProductionReadiness } from "./widget-production-readiness";

describe("widget production readiness", () => {
  it("waits for a live page URL before checks start", () => {
    expect(
      buildWidgetProductionReadiness({
        answerResult: null,
        installResult: null,
        widgetPageUrl: ""
      })
    ).toMatchObject({
      label: "Live verification not started",
      status: "not-started"
    });
  });

  it("blocks production launch when the installed widget check fails", () => {
    expect(
      buildWidgetProductionReadiness({
        answerResult: null,
        installResult: installResultFactory({
          message: "Widget origin is blocked.",
          nextAction: "Add this origin in settings.",
          status: "blocked-origin"
        }),
        widgetPageUrl: "https://agency.example.com/listings"
      })
    ).toMatchObject({
      label: "Live install blocked",
      nextAction: "Add this origin in settings.",
      status: "blocked"
    });
  });

  it("asks for review when the live answer check is not grounded", () => {
    expect(
      buildWidgetProductionReadiness({
        answerResult: summarizeConciergeAnswerCheck(widgetAskResponseFactory({ citations: [], matchedPropertyIds: [] })),
        installResult: installResultFactory(),
        widgetPageUrl: "https://agency.example.com/listings"
      })
    ).toMatchObject({
      label: "AI answer needs review",
      status: "review"
    });
  });

  it("marks the widget live verified only after install and answer checks pass", () => {
    const readiness = buildWidgetProductionReadiness({
      answerResult: summarizeConciergeAnswerCheck(
        widgetAskResponseFactory({
          answer:
            "Wongamat Sea View Residence fits the Pattaya sea-view request under 5M THB because it has beach access, clear price fit, and supporting buyer guidance. Key risks to review are foreign quota, sinking fund, maintenance fees, and whether future construction could affect the view.",
          citations: [
            { label: "Wongamat Sea View Residence", propertyId: "property-1", source: "property" },
            { documentId: "knowledge-1", label: "Buying guide", source: "knowledge" }
          ],
          matchedPropertyIds: ["property-1"]
        })
      ),
      installResult: installResultFactory(),
      widgetPageUrl: "https://agency.example.com/listings"
    });

    expect(readiness).toMatchObject({
      label: "Live widget verified",
      status: "verified"
    });
    expect(readiness.checks.every((check) => check.done)).toBe(true);
  });
});

function installResultFactory(overrides: Partial<TenantWidgetInstallCheckResponse> = {}): TenantWidgetInstallCheckResponse {
  return {
    allowedOrigin: true,
    checkedAt: "2026-08-04T00:00:00.000Z",
    checks: [],
    expectedTenantSlug: "demo-agency",
    message: "Widget is installed and tenant scoped.",
    nextAction: "Ask the live Concierge.",
    origin: "https://agency.example.com",
    status: "verified",
    url: "https://agency.example.com/listings",
    ...overrides
  };
}

function widgetAskResponseFactory(overrides: Partial<PublicWidgetAskResponse> = {}): PublicWidgetAskResponse {
  return {
    answer: "The Concierge needs stronger grounding before production launch.",
    citations: [],
    conciergeMode: "starter",
    createdAt: "2026-08-04T00:00:00.000Z",
    generation: {
      mode: "llm",
      model: "gemini-2.5-flash",
      provider: "gemini"
    },
    id: "answer-1",
    insights: [],
    locale: "en",
    matchedPropertyIds: [],
    message: "Find a Pattaya sea-view condo",
    recommendedListings: [],
    suggestedActions: [],
    tenantSlug: "demo-agency",
    ...overrides
  };
}
