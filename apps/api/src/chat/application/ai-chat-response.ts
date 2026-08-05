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

  if (options.textGenerator.isConfigured()) {
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
