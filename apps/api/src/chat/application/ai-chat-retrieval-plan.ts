import type { AiChatRequest } from "@propertyflow/contracts";
import { classifyAiChatIntent, type AiChatIntent } from "./ai-chat-intent.js";

const recentSetReferencePattern =
  /\b(them|these|those|options|listings|ones)\b|из них|этих|вариант|предлож|ตัวเลือก|รายการ|เหล่านี้|พวกนี้|这些|這些|这几个|這幾個|其中|房源|选项|選項/i;

const beachDistanceComparisonPattern =
  /closer|closest|nearer|nearest|close to|distance|beach|пляж|мор|ใกล้|ที่สุด|ชายหาด|ทะเล|距离|距離|近|最近|海滩|海灘|海边|海邊/i;
const viewingSlotFollowUpPattern =
  /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm|morning|afternoon|evening|tonight|\d{1,2}(?::\d{2})?)\b|сегодня|завтра|понедельник|вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресенье|утром|днем|вечером|час|โมง|พรุ่งนี้|วันนี้|วันจันทร์|วันอังคาร|วันพุธ|วันพฤหัส|วันศุกร์|วันเสาร์|วันอาทิตย์|上午|下午|晚上|明天|今天|周一|週一|周二|週二|周三|週三|周四|週四|周五|週五|周六|週六|周日|週日/i;
const contextualPropertyReferencePattern =
  /\b(?:it|this\s+(?:condo|property|listing|option|unit|project|one)|that\s+(?:condo|property|listing|option|unit|project|one))\b|эт(?:от|а|о|у|ого|ой)?\s+(?:кондо|объект|вариант|квартир[ауы]?|проект)|\b(?:его|ее|её|он|она)\b|ห้องนี้|คอนโดนี้|ตัวเลือกนี้|รายการนี้|โครงการนี้|这个(?:房源|公寓|项目|項目|单位|單位|选择|選擇)|這個(?:房源|公寓|项目|項目|单位|單位|选择|選擇)|这套|這套|它/i;

export interface AiChatRetrievalPlan {
  comparison?: "beach-distance";
  intent: AiChatIntent;
  mode: "clarify-reference" | "listing-comparison" | "listing-search" | "property-detail";
  propertyId?: string;
  reason: "comparison-follow-up" | "explicit-property" | "follow-up-reference" | "missing-follow-up-reference" | "search-request";
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

  if (isRecentListingComparisonRequest(request) && getRecentRecommendations(request).length > 1) {
    return {
      comparison: "beach-distance",
      intent: {
        ...intent,
        includeNeighborhood: true
      },
      mode: "listing-comparison",
      reason: "comparison-follow-up"
    };
  }

  if (isViewingSlotFollowUp(request)) {
    const propertyId = resolveReferencedPropertyId(request, intent.referencedListingIndex ?? 0);

    if (propertyId) {
      return {
        intent: {
          ...intent,
          route: "property-follow-up"
        },
        mode: "property-detail",
        propertyId,
        reason: "follow-up-reference"
      };
    }
  }

  if (isContextualPropertyFollowUp(request)) {
    const propertyId = resolveReferencedPropertyId(request, 0);

    if (propertyId) {
      return {
        intent: {
          ...intent,
          route: "property-follow-up"
        },
        mode: "property-detail",
        propertyId,
        reason: "follow-up-reference"
      };
    }
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

function isViewingSlotFollowUp(request: AiChatRequest): boolean {
  const recommendations = getRecentRecommendations(request);

  return recommendations.length > 0 && viewingSlotFollowUpPattern.test(request.message);
}

function isContextualPropertyFollowUp(request: AiChatRequest): boolean {
  const recommendations = getRecentRecommendations(request);
  const message = normalizeReferenceText(request.message);

  return recommendations.length > 0 && contextualPropertyReferencePattern.test(message);
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

export function getRecentRecommendations(request: AiChatRequest): Array<{ propertyId: string; title: string }> {
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

function isRecentListingComparisonRequest(request: AiChatRequest): boolean {
  const message = normalizeReferenceText(request.message);
  const referencesRecentSet = recentSetReferencePattern.test(message);
  const asksBeachDistance = beachDistanceComparisonPattern.test(message);

  return referencesRecentSet && asksBeachDistance;
}

function normalizeReferenceText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
