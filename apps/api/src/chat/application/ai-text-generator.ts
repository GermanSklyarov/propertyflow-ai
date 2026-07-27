import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { AiChatCitation } from "@propertyflow/contracts";

export const AI_TEXT_GENERATOR = Symbol("AI_TEXT_GENERATOR");

export interface AiTextGenerationRequest {
  locale: "en" | "ru" | "th" | "zh";
  message: string;
  context: string;
  citations: AiChatCitation[];
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
            content: [
              "You are a production AI property concierge for a Thailand real-estate agency.",
              "Answer only from the supplied tenant context. If the context is insufficient, say what is missing.",
              "Be concise, practical, and cite property or knowledge names naturally.",
              `Respond in locale ${request.locale}.`
            ].join(" ")
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
                    "You are a production AI property concierge for a Thailand real-estate agency.",
                    "Answer only from the supplied tenant context. If the context is insufficient, say what is missing.",
                    "Be concise, practical, and cite property or knowledge names naturally.",
                    `Respond in locale ${request.locale}.`,
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
