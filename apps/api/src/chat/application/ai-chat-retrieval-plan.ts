import type { AiChatRequest } from "@propertyflow/contracts";
import { classifyAiChatIntent, type AiChatIntent } from "./ai-chat-intent.js";

export interface AiChatRetrievalPlan {
  intent: AiChatIntent;
  mode: "clarify-reference" | "listing-search" | "property-detail";
  propertyId?: string;
  reason: "explicit-property" | "follow-up-reference" | "missing-follow-up-reference" | "search-request";
}

export function planAiChatRetrieval(request: AiChatRequest): AiChatRetrievalPlan {
  const intent = classifyAiChatIntent(request.message);

  if (request.propertyId) {
    return {
      intent,
      mode: "property-detail",
      propertyId: request.propertyId,
      reason: "explicit-property"
    };
  }

  if (intent.route === "property-follow-up") {
    const propertyId = resolveReferencedPropertyId(request, intent.referencedListingIndex ?? 0);

    return propertyId
      ? {
          intent,
          mode: "property-detail",
          propertyId,
          reason: "follow-up-reference"
        }
      : {
          intent,
          mode: "clarify-reference",
          reason: "missing-follow-up-reference"
        };
  }

  return {
    intent,
    mode: "listing-search",
    reason: "search-request"
  };
}

function resolveReferencedPropertyId(request: AiChatRequest, referencedListingIndex: number): string | undefined {
  const recommendations = [...(request.conversation ?? [])]
    .reverse()
    .flatMap((turn) => turn.recommendedListings ?? [])
    .filter((listing) => listing.propertyId);

  if (!recommendations.length) {
    return undefined;
  }

  return recommendations[referencedListingIndex]?.propertyId ?? recommendations[0]?.propertyId;
}
