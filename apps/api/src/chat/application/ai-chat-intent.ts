export interface AiChatIntent {
  includeAdvice: boolean;
  includeNeighborhood: boolean;
  referencedListingIndex?: number;
  route: "property-follow-up" | "search";
  wantsViewing: boolean;
}

const propertyFollowUpPattern =
  /(first option|second option|third option|see it|view it|visit|viewing|schedule|book|перв|втор|трет|посмотр|просмотр|запис|นัดดู|ดูห้อง|ดูคอนโด|ตัวเลือก|第[123]|第一|第二|第三|看房|预约|預約)/i;
const viewingRequestPattern =
  /\b(?:see|view|visit|viewing|schedule|book|available|availability|possible|rent\s+on)\b|посмотр|просмотр|запис|доступ|свобод|можно|นัดดู|ดูห้อง|ดูคอนโด|ว่าง|预约|預約|看房|可租|可以/i;

const thirdListingPattern = /\b(?:third|3(?:rd)?\s+(?:option|listing|one))\b|трет|สาม|第三|第3|三/i;
const secondListingPattern = /\b(?:second|2(?:nd)?\s+(?:option|listing|one))\b|втор|สอง|第二|第2|二/i;

const neighborhoodPattern =
  /(рядом|around|near|neighborhood|район|пляж|beach|кафе|cafe|школ|school|hospital|больниц)/i;

const advicePattern = /(почему|why|better|лучше|плюс|минус|risk|риск|investment|инвест|yield|доходн)/i;

export function classifyAiChatIntent(message: string): AiChatIntent {
  const normalized = normalizeIntentText(message);
  const isPropertyFollowUp = propertyFollowUpPattern.test(normalized);

  return {
    includeAdvice: advicePattern.test(normalized),
    includeNeighborhood: neighborhoodPattern.test(normalized),
    referencedListingIndex: isPropertyFollowUp ? resolveReferencedListingIndex(normalized) : undefined,
    route: isPropertyFollowUp ? "property-follow-up" : "search",
    wantsViewing: viewingRequestPattern.test(normalized)
  };
}

function resolveReferencedListingIndex(message: string): number | undefined {
  if (thirdListingPattern.test(message)) {
    return 2;
  }

  if (secondListingPattern.test(message)) {
    return 1;
  }

  if (/\b(?:first|1(?:st)?\s+(?:option|listing|one))\b|перв|第一|第1|一/i.test(message)) {
    return 0;
  }

  return undefined;
}

function normalizeIntentText(message: string): string {
  return message.toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ").trim();
}
