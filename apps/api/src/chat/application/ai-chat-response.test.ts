import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AiChatCitation, AiChatRequest } from "@propertyflow/contracts";
import {
  buildAiChatGenerationContext,
  buildAiChatResponse,
  buildClarifyPropertyReferenceResponse,
  buildUnavailablePropertyResponse
} from "./ai-chat-response.js";
import type { AiTextGenerator } from "./ai-text-generator.js";

describe("ai-chat-response", () => {
  const request: AiChatRequest = {
    conversation: [
      { role: "user", text: "Find condos in Pattaya" },
      {
        recommendedListings: [{ propertyId: "property-1", title: "Price Comparable A" }],
        role: "assistant",
        text: "I found one option."
      }
    ],
    locale: "en",
    message: "May I see it?"
  };
  const citations: AiChatCitation[] = [{ label: "Price Comparable A, pattaya, 2850000 THB", propertyId: "property-1", source: "property" }];

  it("generates through the configured text generator with conversation context", async () => {
    const textGenerator: AiTextGenerator = {
      generate: vi.fn().mockResolvedValue({
        answer: "Generated grounded answer.",
        model: "configured-model",
        provider: "openai"
      }),
      isConfigured: vi.fn().mockReturnValue(true)
    };

    const response = await buildAiChatResponse({
      citations,
      context: "Listing context",
      deterministicDraft: "Draft answer",
      idFactory: () => "response-1",
      insights: [],
      matchedPropertyIds: ["property-1"],
      now: () => new Date("2026-07-21T00:00:00.000Z"),
      request,
      suggestedActions: ["create-lead"],
      textGenerator,
      useDeterministicFallback: false
    });

    expect(response).toMatchObject({
      answer: "Generated grounded answer.",
      createdAt: "2026-07-21T00:00:00.000Z",
      generation: {
        mode: "llm",
        model: "configured-model",
        provider: "openai"
      },
      id: "response-1",
      matchedPropertyIds: ["property-1"]
    });
    expect(textGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining("Recommended listings shown:\n1. Price Comparable A (property-1)"),
        message: "May I see it?"
      })
    );
  });

  it("rejects deterministic fallback unless explicitly enabled", async () => {
    const textGenerator: AiTextGenerator = {
      generate: vi.fn(),
      isConfigured: vi.fn().mockReturnValue(false)
    };

    await expect(
      buildAiChatResponse({
        citations: [],
        context: "Listing context",
        deterministicDraft: "Draft answer",
        insights: [],
        matchedPropertyIds: [],
        request,
        suggestedActions: [],
        textGenerator,
        useDeterministicFallback: false
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("falls back to grounded retrieval output when the configured text generator fails", async () => {
    const textGenerator: AiTextGenerator = {
      generate: vi.fn().mockRejectedValue(new Error("AI provider request failed: 429")),
      isConfigured: vi.fn().mockReturnValue(true)
    };

    const response = await buildAiChatResponse({
      citations,
      context: "Listing context",
      deterministicDraft: "Draft answer with real listings.",
      idFactory: () => "response-llm-failed",
      insights: [],
      matchedPropertyIds: ["property-1"],
      now: () => new Date("2026-07-21T00:00:00.000Z"),
      request,
      suggestedActions: ["create-lead"],
      textGenerator,
      useDeterministicFallback: false
    });

    expect(response).toMatchObject({
      answer: "Draft answer with real listings.",
      generation: {
        mode: "deterministic-fallback",
        reason: "AI provider failed after retrieval: AI provider request failed: 429"
      },
      matchedPropertyIds: ["property-1"]
    });
  });

  it("marks explicit deterministic fallback as local-demo output", async () => {
    const textGenerator: AiTextGenerator = {
      generate: vi.fn(),
      isConfigured: vi.fn().mockReturnValue(false)
    };

    const response = await buildAiChatResponse({
      citations,
      context: "Listing context",
      deterministicDraft: "Draft answer",
      idFactory: () => "response-1",
      insights: [],
      matchedPropertyIds: ["property-1"],
      now: () => new Date("2026-07-21T00:00:00.000Z"),
      request,
      suggestedActions: ["create-lead"],
      textGenerator,
      useDeterministicFallback: true
    });

    expect(response).toMatchObject({
      answer: "Draft answer",
      generation: {
        mode: "deterministic-fallback",
        reason: "AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK is enabled"
      }
    });
  });

  it("builds deterministic clarification responses without search side effects", () => {
    const response = buildClarifyPropertyReferenceResponse(request, {
      idFactory: () => "response-clarify",
      now: () => new Date("2026-07-21T00:00:00.000Z")
    });

    expect(response.answer).toContain("Which listing would you like to view?");
    expect(response.generation).toEqual({
      mode: "deterministic-fallback",
      reason: "Clarification is required before property-specific retrieval."
    });
    expect(response.suggestedActions).toContain("ask-visitor-to-pick-listing");
  });

  it("builds deterministic unavailable-listing responses for stale property references", () => {
    const response = buildUnavailablePropertyResponse(
      {
        locale: "en",
        message: "May I see this listing?",
        propertyId: "missing-property"
      },
      {
        idFactory: () => "response-unavailable",
        now: () => new Date("2026-07-21T00:00:00.000Z")
      }
    );

    expect(response.answer).toContain("I cannot access that listing");
    expect(response.generation).toEqual({
      mode: "deterministic-fallback",
      reason: "Requested property was not found in this tenant workspace."
    });
    expect(response.insights).toEqual([
      {
        detail: "The visitor asked about a listing that is no longer available in the tenant workspace.",
        kind: "handoff",
        propertyId: "missing-property",
        severity: "warning",
        title: "Listing unavailable"
      }
    ]);
    expect(response.suggestedActions).toContain("search-similar-listings");
  });

  it("builds the final generation context from conversation, evidence, and draft", () => {
    const context = buildAiChatGenerationContext(request, "Tenant listing evidence", "Draft answer");

    expect(context).toContain("Recent conversation. Use it to resolve follow-up references");
    expect(context).toContain("Tenant listing evidence");
    expect(context).toContain("Deterministic retrieval draft:\nDraft answer");
  });
});
