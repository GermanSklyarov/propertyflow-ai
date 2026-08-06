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
  const namedPropertyId = resolveNamedPropertyId(request);

  if (request.propertyId) {
    return {
      intent,
      mode: "property-detail",
      propertyId: request.propertyId,
      reason: "explicit-property"
    };
  }

  if (namedPropertyId) {
    return {
      intent: {
        ...intent,
        route: "property-follow-up"
      },
      mode: "property-detail",
      propertyId: namedPropertyId,
      reason: "follow-up-reference"
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
  const recommendations = getRecentRecommendations(request);

  if (!recommendations.length) {
    return undefined;
  }

  return recommendations[referencedListingIndex]?.propertyId ?? recommendations[0]?.propertyId;
}

function resolveNamedPropertyId(request: AiChatRequest): string | undefined {
  const normalizedMessage = normalizeReferenceText(request.message);

  if (!normalizedMessage) {
    return undefined;
  }

  return getRecentRecommendations(request).find((listing) => {
    const title = normalizeReferenceText(listing.title);

    return title && normalizedMessage.includes(title);
  })?.propertyId;
}

function getRecentRecommendations(request: AiChatRequest): Array<{ propertyId: string; title: string }> {
  const seen = new Set<string>();

  return [...(request.conversation ?? [])]
    .reverse()
    .flatMap((turn) => turn.recommendedListings ?? [])
    .filter((listing): listing is { propertyId: string; title: string } => Boolean(listing.propertyId?.trim() && listing.title?.trim()))
    .filter((listing) => {
      if (seen.has(listing.propertyId)) {
        return false;
      }

      seen.add(listing.propertyId);

      return true;
    });
}

function normalizeReferenceText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
