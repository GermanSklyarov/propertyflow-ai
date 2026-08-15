import { ServiceUnavailableException } from "@nestjs/common";
import type { AiChatCitation, AiChatInsight, AiChatRequest, AiChatResponse } from "@propertyflow/contracts";
import { buildConversationContext } from "./ai-chat-context.js";
import type { AiConciergePersona, AiTextGenerator } from "./ai-text-generator.js";

export interface BuildAiChatResponseOptions {
  citations: AiChatCitation[];
  context: string;
  deterministicDraft: string;
  idFactory?: () => string;
  insights: AiChatInsight[];
  forceDeterministic?: boolean;
  matchedPropertyIds: string[];
  now?: () => Date;
  persona?: AiConciergePersona;
  request: AiChatRequest;
  suggestedActions: string[];
  textGenerator: AiTextGenerator;
  useDeterministicFallback: boolean;
}

export async function buildAiChatResponse(options: BuildAiChatResponseOptions): Promise<AiChatResponse> {
  const createdAt = timestamp(options);
  const id = responseId(options);

  if (options.forceDeterministic) {
    return buildDeterministicAiChatResponse({
      ...options,
      createdAt,
      id,
      reason: "Deterministic response required for grounded handoff",
      text: options.deterministicDraft
    });
  }

  if (options.textGenerator.isConfigured()) {
    try {
      const generated = await options.textGenerator.generate({
        citations: options.citations,
        context: buildAiChatGenerationContext(options.request, options.context, options.deterministicDraft),
        locale: options.request.locale,
        message: options.request.message,
        persona: options.persona
      });

      return {
        id,
        message: options.request.message,
        answer: generated.answer,
        matchedPropertyIds: options.matchedPropertyIds,
        citations: options.citations,
        insights: options.insights,
        suggestedActions: options.suggestedActions,
        generation: {
          mode: "llm",
          provider: generated.provider,
          model: generated.model
        },
        createdAt
      };
    } catch (error) {
      return buildDeterministicAiChatResponse({
        ...options,
        createdAt,
        id,
        reason: `AI provider failed after retrieval: ${toErrorMessage(error)}`,
        text: options.deterministicDraft
      });
    }
  }

  if (!options.useDeterministicFallback) {
    throw new ServiceUnavailableException(
      "AI provider is not configured. Set OPENAI_API_KEY and AI_CHAT_MODEL, or explicitly enable AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK for local demos."
    );
  }

  return buildDeterministicAiChatResponse({
    ...options,
    createdAt,
    id,
    reason: "AI_ALLOW_DETERMINISTIC_CHAT_FALLBACK is enabled",
    text: options.deterministicDraft
  });
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export function buildClarifyPropertyReferenceResponse(
  request: AiChatRequest,
  options: { idFactory?: () => string; now?: () => Date } = {}
): AiChatResponse {
  return buildDeterministicAiChatResponse({
    citations: [],
    createdAt: timestamp(options),
    id: responseId(options),
    insights: [
      {
        kind: "handoff",
        title: "Listing reference needed",
        detail: "The visitor asked to view a property, but no previous recommendation was available in the conversation context.",
        severity: "info"
      }
    ],
    matchedPropertyIds: [],
    reason: "Clarification is required before property-specific retrieval.",
    request,
    suggestedActions: ["ask-visitor-to-pick-listing", "create-lead"],
    text:
      "Which listing would you like to view? Please send the listing name or choose one of the property cards above, and I can help arrange the next step."
  });
}

export function buildUnavailablePropertyResponse(
  request: AiChatRequest,
  options: { idFactory?: () => string; now?: () => Date } = {}
): AiChatResponse {
  return buildDeterministicAiChatResponse({
    citations: [],
    createdAt: timestamp(options),
    id: responseId(options),
    insights: [
      {
        kind: "handoff",
        title: "Listing unavailable",
        detail: "The visitor asked about a listing that is no longer available in the tenant workspace.",
        propertyId: request.propertyId,
        severity: "warning"
      }
    ],
    matchedPropertyIds: [],
    reason: "Requested property was not found in this tenant workspace.",
    request,
    suggestedActions: ["search-similar-listings", "ask-agent-for-current-availability", "create-lead"],
    text:
      "I cannot access that listing in the agency workspace right now. It may have been removed or become unavailable. I can look for similar current options, or ask an agent to confirm availability."
  });
}

export function buildAiChatGenerationContext(
  request: AiChatRequest,
  context: string,
  deterministicDraft: string
): string {
  return [
    buildConversationContext(request),
    context,
    "",
    "Deterministic retrieval draft:",
    deterministicDraft
  ].filter(Boolean).join("\n");
}

function buildDeterministicAiChatResponse(options: {
  citations: AiChatCitation[];
  createdAt: string;
  id: string;
  insights: AiChatInsight[];
  matchedPropertyIds: string[];
  reason: string;
  request: AiChatRequest;
  suggestedActions: string[];
  text: string;
}): AiChatResponse {
  return {
    id: options.id,
    message: options.request.message,
    answer: options.text,
    matchedPropertyIds: options.matchedPropertyIds,
    citations: options.citations,
    insights: options.insights,
    suggestedActions: options.suggestedActions,
    generation: {
      mode: "deterministic-fallback",
      reason: options.reason
    },
    createdAt: options.createdAt
  };
}

function responseId(options: { idFactory?: () => string }): string {
  return options.idFactory?.() ?? crypto.randomUUID();
}

function timestamp(options: { now?: () => Date }): string {
  return (options.now?.() ?? new Date()).toISOString();
}
