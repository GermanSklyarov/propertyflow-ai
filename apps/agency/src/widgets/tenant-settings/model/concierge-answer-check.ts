import type { PublicWidgetAskResponse, TenantWidgetLanguage } from "@propertyflow/contracts";

export type ConciergeAnswerCheckStatus = "verified" | "review";

export interface ConciergeAnswerCheckCitationSummary {
  knowledge: number;
  property: number;
  total: number;
}

export interface ConciergeAnswerCheckResult {
  answerPreview: string;
  citations: ConciergeAnswerCheckCitationSummary;
  generation: PublicWidgetAskResponse["generation"];
  label: string;
  locale: TenantWidgetLanguage;
  matchedProperties: number;
  message: string;
  nextAction: string;
  status: ConciergeAnswerCheckStatus;
  tenantSlug: string;
}

export interface ConciergeAnswerCheckRequestContext {
  origin: string;
  referer: string;
  url: string;
}

const defaultCheckMessages: Record<TenantWidgetLanguage, string> = {
  en: "I need a Pattaya sea-view condo under 5M THB. Explain why it fits and mention risks.",
  ru: "Подбери кондо в Паттайе с видом на море до 5 млн бат. Объясни, почему подходит, и назови риски.",
  th: "ช่วยหาคอนโดวิวทะเลในพัทยาไม่เกิน 5 ล้านบาท พร้อมอธิบายเหตุผลและความเสี่ยง",
  zh: "请推荐芭堤雅500万泰铢以内的海景公寓，并说明适合原因和风险。"
};

export function getDefaultConciergeAnswerCheckMessage(locale: TenantWidgetLanguage) {
  return defaultCheckMessages[locale] ?? defaultCheckMessages.en;
}

export function buildConciergeAnswerCheckRequestContext(pageUrl: string): ConciergeAnswerCheckRequestContext | null {
  try {
    const url = new URL(pageUrl.trim());

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return {
      origin: url.origin.toLowerCase(),
      referer: url.toString(),
      url: url.toString()
    };
  } catch {
    return null;
  }
}

export function summarizeConciergeAnswerCheck(response: PublicWidgetAskResponse): ConciergeAnswerCheckResult {
  const propertyCitations = response.citations.filter((citation) => citation.source === "property").length;
  const knowledgeCitations = response.citations.filter((citation) => citation.source === "knowledge").length;
  const matchedProperties = response.matchedPropertyIds.length;
  const isLlmAnswer = response.generation?.mode === "llm";
  const hasUsefulAnswer = response.answer.trim().length >= 120;
  const hasGrounding = propertyCitations > 0 && knowledgeCitations > 0 && matchedProperties > 0;
  const verified = isLlmAnswer && hasUsefulAnswer && hasGrounding;

  return {
    answerPreview: buildAnswerPreview(response.answer),
    citations: {
      knowledge: knowledgeCitations,
      property: propertyCitations,
      total: response.citations.length
    },
    generation: response.generation,
    label: verified ? "AI answer verified" : "Review AI answer",
    locale: response.locale,
    matchedProperties,
    message: verified
      ? "Concierge answered through the configured LLM and grounded the answer in listings plus knowledge sources."
      : buildReviewMessage({ hasGrounding, hasUsefulAnswer, isLlmAnswer }),
    nextAction: verified
      ? "Use this tenant widget with the same knowledge base and locale settings."
      : "Check provider credentials, source coverage, and whether enough AI-ready knowledge has been indexed.",
    status: verified ? "verified" : "review",
    tenantSlug: response.tenantSlug
  };
}

function buildAnswerPreview(answer: string) {
  const compact = answer.replace(/\s+/g, " ").trim();

  if (compact.length <= 320) {
    return compact;
  }

  return `${compact.slice(0, 317)}...`;
}

function buildReviewMessage(input: { hasGrounding: boolean; hasUsefulAnswer: boolean; isLlmAnswer: boolean }) {
  if (!input.isLlmAnswer) {
    return "Concierge returned a deterministic fallback instead of an LLM answer.";
  }

  if (!input.hasGrounding) {
    return "Concierge answered, but the response is not grounded in both listings and knowledge sources yet.";
  }

  if (!input.hasUsefulAnswer) {
    return "Concierge answered, but the response is too thin for a production readiness check.";
  }

  return "Concierge answered, but the readiness check needs manual review.";
}
