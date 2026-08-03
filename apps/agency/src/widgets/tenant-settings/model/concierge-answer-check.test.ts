import { describe, expect, it } from "vitest";
import type { PublicWidgetAskResponse } from "@propertyflow/contracts";
import {
  buildConciergeAnswerCheckRequestContext,
  getDefaultConciergeAnswerCheckMessage,
  summarizeConciergeAnswerCheck
} from "./concierge-answer-check";

describe("concierge answer check model", () => {
  it("marks grounded LLM answers as verified", () => {
    const result = summarizeConciergeAnswerCheck(
      responseFactory({
        answer:
          "Wongamat Sea View Residence fits because it is in Pattaya, under the requested budget, close to the beach, and supported by the agency knowledge base. Main risks are quota, maintenance fees, and future construction.",
        citations: [
          { label: "Search", source: "search" },
          {
            label: "Wongamat Sea View Residence",
            propertyId: "property-1",
            source: "property"
          },
          {
            documentId: "knowledge-1",
            label: "Buying guide",
            source: "knowledge"
          }
        ],
        matchedPropertyIds: ["property-1"]
      })
    );

    expect(result).toMatchObject({
      label: "AI answer verified",
      matchedProperties: 1,
      status: "verified"
    });
    expect(result.citations).toEqual({
      knowledge: 1,
      property: 1,
      total: 3
    });
  });

  it("asks for review when the provider falls back to deterministic answers", () => {
    const result = summarizeConciergeAnswerCheck(
      responseFactory({
        generation: {
          mode: "deterministic-fallback",
          reason: "AI provider disabled"
        }
      })
    );

    expect(result).toMatchObject({
      label: "Review AI answer",
      message: "Concierge returned a deterministic fallback instead of an LLM answer.",
      status: "review"
    });
  });

  it("keeps locale-specific smoke prompts available", () => {
    expect(getDefaultConciergeAnswerCheckMessage("ru")).toContain("Паттайе");
    expect(getDefaultConciergeAnswerCheckMessage("th")).toContain("พัทยา");
  });

  it("normalizes a widget page URL into browser request headers", () => {
    expect(buildConciergeAnswerCheckRequestContext(" HTTPS://Agency.Example.com/listings?unit=42 ")).toEqual({
      origin: "https://agency.example.com",
      referer: "https://agency.example.com/listings?unit=42",
      url: "https://agency.example.com/listings?unit=42"
    });
    expect(buildConciergeAnswerCheckRequestContext("mailto:sales@example.com")).toBeNull();
    expect(buildConciergeAnswerCheckRequestContext("not a url")).toBeNull();
  });
});

function responseFactory(overrides: Partial<PublicWidgetAskResponse> = {}): PublicWidgetAskResponse {
  return {
    answer: "The Concierge found one listing but needs more source coverage before this answer can be trusted for production launch.",
    citations: [],
    conciergeMode: "starter",
    createdAt: "2026-07-28T00:00:00.000Z",
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
    suggestedActions: [],
    tenantSlug: "demo-agency",
    ...overrides
  };
}
