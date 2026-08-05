import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type {
  AiChatCitation,
  TenantLeadQualificationField,
  TenantWidgetPersonaGender,
  TenantWidgetTone
} from "@propertyflow/contracts";

export const AI_TEXT_GENERATOR = Symbol("AI_TEXT_GENERATOR");

export interface AiConciergePersona {
  leadQualificationFields?: TenantLeadQualificationField[];
  name?: string;
  tone?: TenantWidgetTone;
  gender?: TenantWidgetPersonaGender;
  welcomeMessage?: string;
}

export interface AiTextGenerationRequest {
  locale: "en" | "ru" | "th" | "zh";
  message: string;
  context: string;
  citations: AiChatCitation[];
  persona?: AiConciergePersona;
}

export interface AiTextGenerationResult {
  answer: string;
  provider: "openai" | "anthropic" | "gemini" | "openrouter";
  model: string;
}

export interface AiTextGenerator {
  isConfigured(): boolean;
  generate(request: AiTextGenerationRequest): Promise<AiTextGenerationResult>;
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

@Injectable()
export class OpenAiTextGenerator implements AiTextGenerator {
  isConfigured(): boolean {
    return Boolean(this.apiKey() && this.model());
  }

  async generate(request: AiTextGenerationRequest): Promise<AiTextGenerationResult> {
    if (this.provider() === "gemini") {
      return this.generateWithGemini(request);
    }

    return this.generateWithOpenAi(request);
  }

  private async generateWithOpenAi(request: AiTextGenerationRequest): Promise<AiTextGenerationResult> {
    const apiKey = this.apiKey();
    const model = this.model();

    if (!apiKey || !model) {
      throw new ServiceUnavailableException("AI provider is not configured");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: this.buildSystemPrompt(request)
          },
          {
            role: "user",
            content: [
              `Visitor question: ${request.message}`,
              "",
              "Tenant context:",
              request.context,
              "",
              `Available citation labels: ${request.citations.map((citation) => citation.label).join(" | ")}`
            ].join("\n")
          }
        ]
      })
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`AI provider request failed: ${response.status}`);
    }

    const payload = (await response.json()) as OpenAiChatCompletionResponse;
    const answer = payload.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new ServiceUnavailableException("AI provider returned an empty answer");
    }

    return {
      answer,
      provider: "openai",
      model
    };
  }

  private async generateWithGemini(request: AiTextGenerationRequest): Promise<AiTextGenerationResult> {
    const apiKey = this.apiKey();
    const model = this.model();

    if (!apiKey || !model) {
      throw new ServiceUnavailableException("AI provider is not configured");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.2
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: [
                    this.buildSystemPrompt(request),
                    "",
                    `Visitor question: ${request.message}`,
                    "",
                    "Tenant context:",
                    request.context,
                    "",
                    `Available citation labels: ${request.citations.map((citation) => citation.label).join(" | ")}`
                  ].join("\n")
                }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      throw new ServiceUnavailableException(`AI provider request failed: ${response.status}`);
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text).join("").trim();

    if (!answer) {
      throw new ServiceUnavailableException("AI provider returned an empty answer");
    }

    return {
      answer,
      provider: "gemini",
      model
    };
  }

  private buildSystemPrompt(request: AiTextGenerationRequest): string {
    const persona = request.persona;
    const personaLines = [
      persona?.name ? `Your public concierge name is "${persona.name}".` : undefined,
      persona?.tone ? `Use a ${persona.tone} tone.` : undefined,
      persona?.gender ? this.genderInstruction(persona.gender, request.locale) : undefined,
      persona?.welcomeMessage ? `Tenant-configured welcome message for this locale: "${persona.welcomeMessage}".` : undefined,
      persona?.leadQualificationFields?.length
        ? `Lead qualification fields to collect naturally when relevant: ${persona.leadQualificationFields.map((field) => leadQualificationFieldLabels[field]).join(", ")}. Ask at most one concise follow-up question at a time; do not block listing recommendations while gathering missing fields.`
        : undefined
    ].filter(Boolean);

    return [
      "You are a production AI property concierge for a Thailand real-estate agency.",
      "Answer only from the supplied tenant context. If the context is insufficient, say what is missing.",
      "Be concise, practical, and cite property or knowledge names naturally in prose.",
      "Do not repeat the tenant welcome message or reintroduce yourself after the first greeting; continue the conversation naturally.",
      "Do not print bracketed citation markers like [1], [2], or numbered source references; the API returns citations separately.",
      "Do not invent facts, prices, risks, yields, fees, availability, or legal details that are not present in the supplied context.",
      "If total matches and top matches differ, clearly say that only the top matches are being shown.",
      `Respond in locale ${request.locale}.`,
      ...personaLines
    ].join(" ");
  }

  private genderInstruction(gender: TenantWidgetPersonaGender, locale: AiTextGenerationRequest["locale"]): string {
    const instructions: Record<TenantWidgetPersonaGender, string> = {
      feminine:
        "Use feminine first-person wording where the response language has grammatical gender, including Russian and Thai polite particles.",
      masculine:
        "Use masculine first-person wording where the response language has grammatical gender, including Russian and Thai polite particles.",
      neutral: "Use neutral wording and avoid gendered first-person phrasing where possible."
    };

    const localeInstructions: Partial<Record<AiTextGenerationRequest["locale"], Partial<Record<TenantWidgetPersonaGender, string>>>> = {
      ru: {
        feminine:
          'In Russian, the concierge speaks as a woman: use first-person feminine forms such as "я нашла", "я подобрала", "я проверила"; never use masculine forms such as "я нашел" or "я подобрал".',
        masculine:
          'In Russian, the concierge speaks as a man: use first-person masculine forms such as "я нашел", "я подобрал", "я проверил".',
        neutral: 'In Russian, avoid gendered first-person past-tense forms when possible; prefer neutral wording such as "подходящие варианты найдены".'
      },
      th: {
        feminine: 'In Thai, use feminine polite particles such as "ค่ะ" when speaking as the concierge.',
        masculine: 'In Thai, use masculine polite particles such as "ครับ" when speaking as the concierge.',
        neutral: "In Thai, use neutral polite wording and avoid gender-specific particles when possible."
      }
    };

    return [instructions[gender], localeInstructions[locale]?.[gender]].filter(Boolean).join(" ");
  }

  private provider(): string {
    return process.env.AI_DEFAULT_PROVIDER?.trim().toLowerCase() || "openai";
  }

  private apiKey(): string | undefined {
    if (this.provider() === "gemini") {
      return process.env.GEMINI_API_KEY?.trim() || undefined;
    }

    return process.env.OPENAI_API_KEY?.trim() || undefined;
  }

  private model(): string | undefined {
    if (this.provider() === "gemini") {
      return process.env.AI_CHAT_MODEL?.trim() || process.env.GEMINI_CHAT_MODEL?.trim() || undefined;
    }

    return (
      process.env.AI_CHAT_MODEL?.trim() ||
      process.env.OPENAI_CHAT_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      undefined
    );
  }
}

const leadQualificationFieldLabels: Record<TenantLeadQualificationField, string> = {
  bedrooms: "bedrooms",
  budget: "budget",
  email: "email",
  financing: "financing or mortgage needs",
  investmentPurpose: "purchase or investment purpose",
  moveInDate: "move-in or visit timing",
  nationality: "nationality when relevant",
  phone: "phone",
  preferredArea: "preferred area",
  whatsapp: "WhatsApp"
};
