import type {
  AiAdvisorSummary,
  AiChatCitation,
  KnowledgeDocumentChunkSnapshot,
  NeighborhoodIntelligence,
  TenantWidgetLanguage
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import {
  buildAiChatContext,
  buildListingEvidence,
  describeProperty,
  knowledgeCitation,
  knowledgeLine,
  propertyCitation
} from "./ai-chat-context.js";
import type { AiChatDueDiligencePayload } from "./ai-chat-due-diligence.js";
import type { AiChatIntent } from "./ai-chat-intent.js";
import type { AiChatResponseDraft } from "./ai-chat-search-response.js";

export function buildAiChatPropertyResponseDraft(options: {
  advisorSummary?: AiAdvisorSummary;
  dueDiligence: AiChatDueDiligencePayload;
  intent: AiChatIntent;
  knowledge: KnowledgeDocumentChunkSnapshot[];
  locale?: TenantWidgetLanguage;
  neighborhood?: NeighborhoodIntelligence;
  property: PropertySnapshot;
  requestMessage?: string;
}): AiChatResponseDraft {
  const citations: AiChatCitation[] = [propertyCitation(options.property)];
  const suitabilityAnswer = buildSuitabilityAnswer(options.property, options.requestMessage);
  const ownershipAnswer = buildOwnershipAnswer(options.property, options.requestMessage);
  const answerParts = [
    options.intent.wantsViewing
      ? buildViewingHandoffAnswer(options.property, options.requestMessage, options.locale)
      : ownershipAnswer ?? suitabilityAnswer ?? describeProperty(options.property)
  ];

  if (options.intent.includeNeighborhood && options.neighborhood) {
    citations.push({
      source: "neighborhood",
      propertyId: options.property.id,
      title: options.property.title,
      label: `Neighborhood intelligence, walkability ${options.neighborhood.walkabilityScore}/5`
    });
    answerParts.push(options.neighborhood.summary);
  }

  if (options.intent.includeAdvice && options.advisorSummary) {
    citations.push({
      source: "advisor",
      propertyId: options.property.id,
      title: options.property.title,
      label: `AI advisor, confidence ${options.advisorSummary.confidence}`
    });
    answerParts.push(`Best for: ${options.advisorSummary.bestFor.join(", ")}.`);
    answerParts.push(`Pros: ${options.advisorSummary.pros.slice(0, 3).join(" ")}`);
    if (options.advisorSummary.cons.length) {
      answerParts.push(`Watch-outs: ${options.advisorSummary.cons.slice(0, 2).join(" ")}`);
    }
  }

  if (options.knowledge.length) {
    citations.push(...options.knowledge.map((chunk) => knowledgeCitation(chunk)));
    answerParts.push(`Relevant knowledge: ${options.knowledge.map((chunk) => knowledgeLine(chunk)).join(" ")}`);
  }

  return {
    citations,
    context: buildAiChatContext(
      [...answerParts, ...buildListingEvidence([options.property]), ...options.dueDiligence.contextLines],
      citations
    ),
    deterministicDraft: answerParts.join(" "),
    insights: options.dueDiligence.insights,
    matchedPropertyIds: [options.property.id],
    suggestedActions: ["compare-similar-properties", "open-investment-calculator", "create-lead"]
  };
}

function buildSuitabilityAnswer(property: PropertySnapshot, requestMessage?: string): string | undefined {
  const normalized = requestMessage?.toLowerCase() ?? "";

  if (/\b(pet|pets|dog|cat|dogs|cats)\b|питом|собак|кош|สัตว์เลี้ยง|หมา|แมว|宠物|寵物|狗|猫|貓/i.test(normalized)) {
    const amenities = new Set(property.amenities.map((amenity) => amenity.toLowerCase()));
    const hasPetSignal = amenities.has("pet-friendly") || amenities.has("pets-allowed");
    const space = `${property.areaSqm} sqm, ${property.bedrooms} bedroom${property.bedrooms === 1 ? "" : "s"}`;
    const rent = property.rentalPriceMonthly
      ? ` Rental ask is ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/mo.`
      : "";

    return hasPetSignal
      ? `${property.title} looks suitable to check for pets: the listing has a pet-friendly signal, ${space}, and ${summarizeLocation(property)}. I would still ask the agent to confirm the building's current pet rules before booking.${rent}`
      : `${property.title} may work on budget and location, but I do not see pet-friendly or pets-allowed confirmed in the listing facts. Please ask the agent to verify the building rules for dogs or cats before you rely on this option.${rent}`;
  }

  if (/\b(kid|kids|child|children|family)\b|семь|ребен|дет|ครอบครัว|เด็ก|家庭|孩子/i.test(normalized)) {
    const bedroomNote =
      property.bedrooms <= 1
        ? `It is a ${property.bedrooms}-bedroom, ${property.areaSqm} sqm unit, so it is more suitable for one adult, a couple, or a small family than for a larger family.`
        : `It has ${property.bedrooms} bedrooms and ${property.areaSqm} sqm, which is more comfortable for family living.`;
    const rent = property.rentalPriceMonthly
      ? ` Rental ask is ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/mo.`
      : "";

    return `${property.title} can be considered for living with kids, but check the layout and building rules carefully. ${bedroomNote} ${summarizeLocation(property)}.${rent}`;
  }

  if (/(without a car|no car|don'?t drive|do not drive|walkable|walkability|public transport|baht bus|без машины|не вожу|нет машины|пешком|общественный транспорт|บาทบัส|รถสองแถว|ไม่ขับรถ|不用车|不用車|不开车|不開車|公共交通)/i.test(normalized)) {
    const features = property.locationFeatures;
    if (!features) {
      return `${property.title} may still be worth checking, but I do not have saved location-intelligence facts for car-free living yet. Ask the agent to confirm walking access to groceries and transport before relying on it.`;
    }

    const facts = [
      features.nearestSupermarketDistanceMeters !== undefined
        ? `a supermarket or convenience store about ${features.nearestSupermarketDistanceMeters}m away`
        : undefined,
      features.nearestBahtBusRouteDistanceMeters !== undefined
        ? `a baht bus route about ${features.nearestBahtBusRouteDistanceMeters}m away`
        : undefined,
      features.nearestPublicTransportDistanceMeters !== undefined
        ? `public transport about ${features.nearestPublicTransportDistanceMeters}m away`
        : undefined,
      features.nearestMallDistanceMeters !== undefined ? `shopping about ${features.nearestMallDistanceMeters}m away` : undefined,
      features.walkabilityScore !== undefined ? `walkability score ${features.walkabilityScore}/100` : undefined
    ].filter(Boolean);
    const suitable =
      (features.walkabilityScore ?? 0) >= 70 &&
      (features.nearestSupermarketDistanceMeters ?? Number.POSITIVE_INFINITY) <= 900 &&
      Math.min(
        features.nearestBahtBusRouteDistanceMeters ?? Number.POSITIVE_INFINITY,
        features.nearestPublicTransportDistanceMeters ?? Number.POSITIVE_INFINITY
      ) <= 700;

    return suitable
      ? `Yes. ${property.title} could be a good option without a car: ${facts.join(", ")}.`
      : `${property.title} is not a clear car-free match from the saved facts: ${facts.join(", ")}. I would compare it with listings that have groceries and transport closer.`;
  }

  return undefined;
}

function buildOwnershipAnswer(property: PropertySnapshot, requestMessage?: string): string | undefined {
  const normalized = requestMessage?.toLowerCase() ?? "";

  if (!/\b(?:foreigner|foreign buyer|foreigners|foreign quota|foreign freehold|foreign name|ownership|own|buy)\b|иностран|фаранг|квот|собствен|ต่างชาติ|ชาวต่างชาติ|โควต้า|ถือครอง|外国|外國|外籍|产权|產權|配额|配額/i.test(normalized)) {
    return undefined;
  }

  const price = `${property.price.amount} ${property.price.currency}`;
  const kind = property.kind;

  if (kind === "condo") {
    return `${property.title} is a condo, so a foreign buyer may be able to buy it as condominium freehold only if foreign quota is available for that building. I cannot confirm the live quota from here, so ask the agent to verify foreign-quota status, title, transfer-fee split, sinking fund, maintenance fee, and closing timeline before relying on it. Listed price is ${price}.`;
  }

  if (kind === "villa" || kind === "townhouse" || kind === "land") {
    return `${property.title} is a ${kind}, not a condominium unit. Foreign buyers generally cannot own Thai land directly, so this needs legal review before any promise: common structures may involve leasehold, a Thai company, or separating building and land rights depending on the case. Ask the agent/lawyer to confirm the title structure, land ownership route, lease terms if any, transfer taxes, and whether the advertised sale is suitable for a foreign buyer. Listed price is ${price}.`;
  }

  return `${property.title} needs ownership-structure verification before advising a foreign buyer. Ask the agent to confirm title, permitted foreign ownership route, transfer costs, and closing timeline. Listed price is ${price}.`;
}

function summarizeLocation(property: PropertySnapshot): string {
  return property.beachDistanceMeters === undefined
    ? "beach distance is not specified"
    : `${property.beachDistanceMeters}m from the beach`;
}

function buildViewingHandoffAnswer(property: PropertySnapshot, requestMessage?: string, locale: TenantWidgetLanguage = "en"): string {
  const preferredSlot = requestMessage ? extractViewingSlot(requestMessage) : undefined;
  const rental = property.rentalPriceMonthly ? formatRentalAsk(property, locale) : "";
  const messages: Record<TenantWidgetLanguage, string> = {
    en: buildEnglishViewingHandoffAnswer(property, preferredSlot, rental),
    ru: buildRussianViewingHandoffAnswer(property, preferredSlot, rental),
    th: buildThaiViewingHandoffAnswer(property, preferredSlot, rental),
    zh: buildChineseViewingHandoffAnswer(property, preferredSlot, rental)
  };

  return messages[locale] ?? messages.en;
}

function buildEnglishViewingHandoffAnswer(property: PropertySnapshot, preferredSlot: string | undefined, rental: string): string {
  const slotText = preferredSlot ? ` for ${preferredSlot}` : "";
  const slotFollowUp = preferredSlot
    ? "I can pass this preferred slot to the agency team."
    : "Please share a convenient day and time for the viewing.";
  const qualificationPrompt =
    isRentalHandoffProperty(property)
      ? " If you already know your target move-in date and contract length, include those too so the agent can check availability and rate."
      : " If you are buying, please also mention whether ownership would be foreign quota, Thai name, or company, and your approximate purchase timing.";

  return `Great choice. I can help arrange a viewing of ${property.title}${slotText}. I cannot directly confirm the agent's calendar from here. ${slotFollowUp} Please share your WhatsApp, Telegram, phone, or email so they can confirm the exact time.${qualificationPrompt}${rental}`;
}

function buildRussianViewingHandoffAnswer(property: PropertySnapshot, preferredSlot: string | undefined, rental: string): string {
  const slotText = preferredSlot ? ` на ${preferredSlot}` : "";
  const slotFollowUp = preferredSlot
    ? "Я передам это время агентству, чтобы они подтвердили точное окно."
    : "Напишите, пожалуйста, удобный день и время для просмотра.";
  const qualificationPrompt =
    isRentalHandoffProperty(property)
      ? "Дата въезда и срок контракта уже помогают проверить доступность и ставку."
      : "Если планируете покупку, также полезно указать формат оформления: foreign quota, Thai name или company.";

  return `Хороший выбор. Я помогу записаться на просмотр ${property.title}${slotText}. Я не вижу календарь агента напрямую, поэтому ${slotFollowUp} Оставьте WhatsApp, Telegram, телефон или email, чтобы агент мог подтвердить просмотр. ${qualificationPrompt}${rental}`;
}

function buildThaiViewingHandoffAnswer(property: PropertySnapshot, preferredSlot: string | undefined, rental: string): string {
  const slotText = preferredSlot ? ` ในช่วง ${preferredSlot}` : "";
  const slotFollowUp = preferredSlot
    ? "ฉันจะส่งช่วงเวลานี้ให้ทีมเอเจนซียืนยันเวลาที่แน่นอน"
    : "กรุณาระบุวันและเวลาที่สะดวกสำหรับนัดชม";
  const qualificationPrompt =
    isRentalHandoffProperty(property)
      ? "วันที่ต้องการเข้าอยู่และระยะสัญญาจะช่วยให้เอเจนต์ตรวจสอบห้องว่างและราคาได้"
      : "ถ้าต้องการซื้อ กรุณาระบุรูปแบบการถือครอง เช่น foreign quota, Thai name หรือ company และช่วงเวลาที่ต้องการซื้อ";

  return `ตัวเลือกนี้ดีมาก ฉันช่วยนัดชม ${property.title}${slotText} ได้ ฉันไม่สามารถยืนยันปฏิทินของเอเจนต์ได้โดยตรง ดังนั้น${slotFollowUp} กรุณาฝาก WhatsApp, Telegram, เบอร์โทร หรือ email เพื่อให้เอเจนต์ยืนยันนัดชม ${qualificationPrompt}${rental}`;
}

function buildChineseViewingHandoffAnswer(property: PropertySnapshot, preferredSlot: string | undefined, rental: string): string {
  const slotText = preferredSlot ? `，时间为 ${preferredSlot}` : "";
  const slotFollowUp = preferredSlot ? "我可以把这个意向时间转给经纪团队确认。" : "请告诉我你方便看房的日期和时间。";
  const qualificationPrompt =
    isRentalHandoffProperty(property)
      ? "入住日期和租期也有助于经纪人确认可租状态和价格。"
      : "如果是购买，也请说明产权形式，比如 foreign quota、Thai name 或 company，以及大致购买时间。";

  return `这个选择不错。我可以帮你预约看 ${property.title}${slotText}。我这里不能直接确认经纪人的日程，${slotFollowUp} 请留下 WhatsApp、Telegram、电话或 email，方便经纪人确认看房。${qualificationPrompt}${rental}`;
}

function isRentalHandoffProperty(property: PropertySnapshot): boolean {
  return property.listingType === "rent" || Boolean(property.rentalPriceMonthly);
}

function formatRentalAsk(property: PropertySnapshot, locale: TenantWidgetLanguage): string {
  if (!property.rentalPriceMonthly) {
    return "";
  }

  const labels: Record<TenantWidgetLanguage, string> = {
    en: ` Rental ask is ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/mo.`,
    ru: ` Арендная ставка: ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/мес.`,
    th: ` ค่าเช่า ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/เดือน`,
    zh: ` 租金为 ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/月。`
  };

  return labels[locale] ?? labels.en;
}

function extractViewingSlot(message: string): string | undefined {
  const normalized = message.replace(/\s+/g, " ").trim();
  const patterns = [
    /\b(?:today|tomorrow|day after tomorrow|next week|this weekend|weekend)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?/i,
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?/i,
    /\b\d{1,2}(?:st|nd|rd|th)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?/i,
    /\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?/i,
    /\bin\s+\d+\s+days?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?/i,
    /\b(?:сегодня|завтра|послезавтра|на выходных|в выходные|на следующей неделе)(?:\s+в\s+\d{1,2}(?::\d{2})?)?/i,
    /\b(?:明天|今天|后天|後天|下周|下週|周末|週末)/i
  ];

  return patterns.map((pattern) => normalized.match(pattern)?.[0]).find(Boolean);
}
