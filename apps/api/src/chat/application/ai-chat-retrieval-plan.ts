import type { AiChatRequest } from "@propertyflow/contracts";
import { classifyAiChatIntent, type AiChatIntent } from "./ai-chat-intent.js";

const recentSetReferencePattern =
  /\b(them|these|those|options|listings|ones)\b|из них|этих|вариант|предлож|ตัวเลือก|รายการ|เหล่านี้|พวกนี้|这些|這些|这几个|這幾個|其中|房源|选项|選項/i;

const beachDistanceComparisonPattern =
  /closer|closest|nearer|nearest|close to|distance|beach|пляж|мор|ใกล้|ที่สุด|ชายหาด|ทะเล|距离|距離|近|最近|海滩|海灘|海边|海邊/i;
const shortlistComparisonPattern =
  /\b(?:compare|which|what|better|best|pick|choose|rank)\b|сравн|како[йе]|лучш|выбр|哪个|哪個|比较|比較|ดีกว่า|ดีที่สุด|เปรียบเทียบ/i;
const investmentComparisonPattern = /investment|invest|yield|roi|rent|rental|доход|инвест|аренд|收益|投资|投資|出租|租金|ลงทุน|ปล่อยเช่า/i;
const relocationComparisonPattern = /relocation|relocat|move|remote|internet|work|quiet|переезд|релокац|удален|интернет|тих|搬家|移居|网络|網絡|安静|ย้าย|ทำงาน|อินเทอร์เน็ต|เงียบ/i;
const livingComparisonPattern = /living|live|family|school|kid|retire|для себя|жить|семь|школ|自住|家庭|学校|學校|อยู่อาศัย|ครอบครัว|โรงเรียน/i;
const petsComparisonPattern = /\bpets?\b|\bdogs?\b|\bcats?\b|собак|кош|питом|สัตว์เลี้ยง|หมา|แมว|宠物|寵物|狗|猫|貓/i;
const moreListingsPattern =
  /\b(?:more|another|other|else|all|everything|next|show\s+all|see\s+all)\b|еще|ещё|друг|остальн|все вариант|покажи все|เพิ่มเติม|ทั้งหมด|其他|更多|全部|所有/i;
const newSearchRefinementPattern =
  /\b(?:i mean|actually|instead|rather|no,?|not important|does not matter|doesn't matter|rent|rental|lease|buy|purchase|budget|under|studio|1 bedroom|one bedroom|move in|move-in|next month|spacious)\b|точнее|вообще|лучше|аренд|купить|бюджет|студ|спальн|въезд|заезд|месяц/i;
const viewingSlotFollowUpPattern =
  /\b(?:today|tomorrow|day after tomorrow|next week|this weekend|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|am|pm|a\.m\.?|p\.m\.?|morning|afternoon|evening|tonight|\d{1,2}(?::\d{2})?|\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))\b|in\s+\d+\s+days?|через\s+\d+\s+дн|послезавтра|сегодня|завтра|следующ|выходн|понедельник|вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресенье|утром|днем|вечером|час|โมง|พรุ่งนี้|วันนี้|วันจันทร์|วันอังคาร|วันพุธ|วันพฤหัส|วันศุกร์|วันเสาร์|วันอาทิตย์|上午|下午|晚上|明天|今天|后天|後天|周一|週一|周二|週二|周三|週三|周四|週四|周五|週五|周六|週六|周日|週日/i;
const contextualPropertyReferencePattern =
  /\b(?:it|this\s+(?:condo|property|listing|option|unit|project|one)|that\s+(?:condo|property|listing|option|unit|project|one))\b|эт(?:от|а|о|у|ого|ой)?\s+(?:кондо|объект|вариант|квартир[ауы]?|проект)|\b(?:его|ее|её|он|она)\b|ห้องนี้|คอนโดนี้|ตัวเลือกนี้|รายการนี้|โครงการนี้|这个(?:房源|公寓|项目|項目|单位|單位|选择|選擇)|這個(?:房源|公寓|项目|項目|单位|單位|选择|選擇)|这套|這套|它/i;
const propertyDetailQuestionPattern =
  /pet|dog|cat|fee|maintenance|quota|foreign|ownership|floor|sqm|size|balcony|furniture|internet|parking|quiet|noise|view|yield|roi|rent|rental|beach|walk|school|family|питом|собак|кош|комис|квот|этаж|площад|балкон|мебел|интернет|парков|тих|шум|вид|доход|аренд|пляж|семь|школ|宠物|狗|猫|貓|费用|費用|楼层|樓層|面积|面積|阳台|陽台|家具|网络|網絡|停车|停車|安静|噪音|景观|景觀|租金|海滩|海灘|家庭|学校|學校|สัตว์เลี้ยง|หมา|แมว|ค่าส่วนกลาง|ชั้น|พื้นที่|ระเบียง|เฟอร์นิเจอร์|อินเทอร์เน็ต|ที่จอดรถ|เงียบ|วิว|ค่าเช่า|ชายหาด|ครอบครัว|โรงเรียน/i;

export interface AiChatRetrievalPlan {
  comparison?: "beach-distance" | "investment" | "living" | "pets" | "relocation";
  intent: AiChatIntent;
  mode: "clarify-reference" | "listing-comparison" | "listing-search" | "property-detail";
  propertyId?: string;
  reason: "comparison-follow-up" | "explicit-property" | "follow-up-reference" | "missing-follow-up-reference" | "search-request";
}

export function planAiChatRetrieval(request: AiChatRequest): AiChatRetrievalPlan {
  const intent = classifyAiChatIntent(request.message);
  const namedPropertyId = resolveNamedPropertyId(request);
  const selectedPropertyId = resolveSelectedPropertyIdFromConversation(request);

  if (isSearchRefinement(request)) {
    return {
      intent: {
        ...intent,
        route: "search"
      },
      mode: "listing-search",
      reason: "search-request"
    };
  }

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

  const comparison = resolveRecentListingComparison(request);

  if (comparison && getRecentRecommendations(request).length > 1) {
    return {
      comparison,
      intent: {
        ...intent,
        includeAdvice: intent.includeAdvice || comparison === "investment",
        includeNeighborhood: intent.includeNeighborhood || comparison === "beach-distance" || comparison === "relocation" || comparison === "living"
      },
      mode: "listing-comparison",
      reason: "comparison-follow-up"
    };
  }

  if (isViewingSlotFollowUp(request)) {
    const propertyId =
      intent.referencedListingIndex === undefined
        ? selectedPropertyId ?? resolveReferencedPropertyId(request, 0)
        : resolveReferencedPropertyId(request, intent.referencedListingIndex);

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
    const propertyId = selectedPropertyId ?? resolveReferencedPropertyId(request, intent.referencedListingIndex ?? 0);

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

  if (isPropertyDetailQuestion(request)) {
    const propertyId = selectedPropertyId ?? resolveReferencedPropertyId(request, intent.referencedListingIndex ?? 0);

    if (propertyId) {
      return {
        intent: {
          ...intent,
          includeAdvice: intent.includeAdvice || investmentComparisonPattern.test(request.message),
          includeNeighborhood: intent.includeNeighborhood || beachDistanceComparisonPattern.test(request.message),
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

function resolveSelectedPropertyIdFromConversation(request: AiChatRequest): string | undefined {
  let currentListings: Array<{ propertyId: string; title: string }> = [];
  let selectedPropertyId: string | undefined;

  for (const turn of request.conversation ?? []) {
    const listings = (turn.recommendedListings ?? [])
      .filter((listing) => listing.propertyId.trim() && listing.title.trim())
      .slice(0, 3);

    if (turn.role === "assistant" && listings.length) {
      currentListings = listings;
      if (listings.length === 1) {
        selectedPropertyId = listings[0]?.propertyId;
      }
    }

    if (turn.role === "user" && currentListings.length) {
      const index = resolveReferencedListingIndexFromText(turn.text);
      const byIndex = index === undefined ? undefined : currentListings[index]?.propertyId;
      const byName = resolveNamedPropertyIdFromListings(turn.text, currentListings);

      selectedPropertyId = byName ?? byIndex ?? selectedPropertyId;
    }
  }

  return selectedPropertyId;
}

function resolveReferencedListingIndexFromText(message: string): number | undefined {
  const normalized = normalizeReferenceText(message);

  if (/\b(?:third|3(?:rd)?\s+(?:option|listing|one))\b|трет|สาม|第三|第3|三/i.test(normalized)) {
    return 2;
  }

  if (/\b(?:second|2(?:nd)?\s+(?:option|listing|one))\b|втор|สอง|第二|第2|二/i.test(normalized)) {
    return 1;
  }

  if (/\b(?:first|1(?:st)?\s+(?:option|listing|one))\b|перв|第一|第1|一/i.test(normalized)) {
    return 0;
  }

  return undefined;
}

function resolveNamedPropertyIdFromListings(
  message: string,
  listings: Array<{ propertyId: string; title: string }>
): string | undefined {
  const normalizedMessage = normalizeReferenceText(message);

  return listings.find((listing) => {
    const title = normalizeReferenceText(listing.title);

    return title && normalizedMessage.includes(title);
  })?.propertyId;
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

function isPropertyDetailQuestion(request: AiChatRequest): boolean {
  const recommendations = getRecentRecommendations(request);
  const message = normalizeReferenceText(request.message);

  return recommendations.length > 0 && !moreListingsPattern.test(message) && propertyDetailQuestionPattern.test(message);
}

function isSearchRefinement(request: AiChatRequest): boolean {
  const recommendations = getRecentRecommendations(request);

  return recommendations.length > 0 && newSearchRefinementPattern.test(request.message);
}

function resolveReferencedPropertyId(request: AiChatRequest, referencedListingIndex: number): string | undefined {
  const recommendations = getRecentRecommendations(request);

  if (!recommendations.length) {
    return undefined;
  }

  return recommendations[referencedListingIndex]?.propertyId;
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

function resolveRecentListingComparison(request: AiChatRequest): AiChatRetrievalPlan["comparison"] | undefined {
  const message = normalizeReferenceText(request.message);
  const referencesRecentSet = recentSetReferencePattern.test(message) || shortlistComparisonPattern.test(message);

  if (!referencesRecentSet || moreListingsPattern.test(message)) {
    return undefined;
  }

  if (beachDistanceComparisonPattern.test(message)) {
    return "beach-distance";
  }

  if (investmentComparisonPattern.test(message)) {
    return "investment";
  }

  if (petsComparisonPattern.test(message)) {
    return "pets";
  }

  if (relocationComparisonPattern.test(message)) {
    return "relocation";
  }

  if (livingComparisonPattern.test(message)) {
    return "living";
  }

  return undefined;
}

function normalizeReferenceText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
