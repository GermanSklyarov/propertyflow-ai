export type KnowledgeEmbeddingProviderName = "local-hash" | "openai" | "gemini";

export type KnowledgeEmbeddingTaskType = "query" | "document";

export interface KnowledgeEmbeddingConfig {
  provider: KnowledgeEmbeddingProviderName;
  model: string;
  dimensions: number;
  apiKey?: string;
}

export interface KnowledgeEmbeddingResult {
  vector: number[];
  provider: KnowledgeEmbeddingProviderName;
  model: string;
  dimensions: number;
  modelKey: string;
  isRemote: boolean;
}

interface OpenAiEmbeddingResponse {
  data?: Array<{
    embedding?: number[];
  }>;
}

interface GeminiEmbeddingResponse {
  embedding?: {
    values?: number[];
  };
}

export class KnowledgeEmbeddingGenerator {
  constructor(private readonly config: KnowledgeEmbeddingConfig = defaultKnowledgeEmbeddingConfig()) {}

  provider(): KnowledgeEmbeddingProviderName {
    return this.config.provider;
  }

  model(): string {
    return this.config.model;
  }

  dimensions(): number {
    return this.config.dimensions;
  }

  modelKey(): string {
    return knowledgeEmbeddingModelKey(this.config.provider, this.config.model);
  }

  isRemoteConfigured(): boolean {
    return this.config.provider !== "local-hash" && Boolean(this.config.apiKey);
  }

  async embed(text: string, taskType: KnowledgeEmbeddingTaskType): Promise<KnowledgeEmbeddingResult> {
    if (this.config.provider === "gemini" && this.config.apiKey) {
      return this.embedWithGemini(text, taskType);
    }

    if (this.config.provider === "openai" && this.config.apiKey) {
      return this.embedWithOpenAi(text);
    }

    return this.embedWithLocalHash(text);
  }

  localFallback(text: string): KnowledgeEmbeddingResult {
    return this.embedWithLocalHash(text);
  }

  private async embedWithOpenAi(text: string): Promise<KnowledgeEmbeddingResult> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: this.config.model,
        input: text
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding request failed: ${response.status}`);
    }

    const payload = (await response.json()) as OpenAiEmbeddingResponse;
    const vector = payload.data?.[0]?.embedding;

    if (!vector?.length) {
      throw new Error("OpenAI embedding response did not include a vector");
    }

    return this.toResult(vector, true);
  }

  private async embedWithGemini(
    text: string,
    taskType: KnowledgeEmbeddingTaskType
  ): Promise<KnowledgeEmbeddingResult> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.config.model)}:embedContent?key=${encodeURIComponent(this.config.apiKey ?? "")}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: `models/${this.config.model}`,
          taskType: taskType === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
          content: {
            parts: [{ text }]
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini embedding request failed: ${response.status}`);
    }

    const payload = (await response.json()) as GeminiEmbeddingResponse;
    const vector = payload.embedding?.values;

    if (!vector?.length) {
      throw new Error("Gemini embedding response did not include a vector");
    }

    return this.toResult(vector, true);
  }

  private embedWithLocalHash(text: string): KnowledgeEmbeddingResult {
    return this.toResult(localHashEmbedding(text, this.config.dimensions), false);
  }

  private toResult(vector: number[], isRemote: boolean): KnowledgeEmbeddingResult {
    return {
      vector,
      provider: this.config.provider,
      model: this.config.model,
      dimensions: vector.length,
      modelKey: this.modelKey(),
      isRemote
    };
  }
}

export function defaultKnowledgeEmbeddingConfig(env: NodeJS.ProcessEnv = process.env): KnowledgeEmbeddingConfig {
  const requestedProvider = (env.AI_EMBEDDING_PROVIDER ?? "").trim().toLowerCase();
  const inferredProvider =
    requestedProvider ||
    (env.GEMINI_API_KEY ? "gemini" : env.OPENAI_API_KEY ? "openai" : "local-hash");
  const provider = isKnowledgeEmbeddingProvider(inferredProvider) ? inferredProvider : "local-hash";

  if (provider === "gemini") {
    return {
      provider,
      model: env.AI_EMBEDDING_MODEL?.trim() || env.GEMINI_EMBEDDING_MODEL?.trim() || "text-embedding-004",
      dimensions: Number(env.AI_EMBEDDING_DIMENSIONS ?? env.GEMINI_EMBEDDING_DIMENSIONS ?? 768),
      apiKey: env.GEMINI_API_KEY?.trim()
    };
  }

  if (provider === "openai") {
    return {
      provider,
      model: env.AI_EMBEDDING_MODEL?.trim() || env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
      dimensions: Number(env.AI_EMBEDDING_DIMENSIONS ?? env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      apiKey: env.OPENAI_API_KEY?.trim()
    };
  }

  return {
    provider: "local-hash",
    model: env.AI_EMBEDDING_MODEL?.trim() || "local-hash-16",
    dimensions: Number(env.AI_EMBEDDING_DIMENSIONS ?? 16)
  };
}

export function knowledgeEmbeddingModelKey(provider: KnowledgeEmbeddingProviderName, model: string): string {
  return `${provider}:${model}`;
}

export function localHashEmbedding(text: string, dimensions: number): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = text
    .toLowerCase()
    .replaceAll("ё", "е")
    .split(/[^a-zа-я0-9-]+/i)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens.length ? tokens : [text]) {
    const hash = hashToken(token);
    const index = Math.abs(hash) % dimensions;
    vector[index] += hash < 0 ? -1 : 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function isKnowledgeEmbeddingProvider(value: string): value is KnowledgeEmbeddingProviderName {
  return value === "local-hash" || value === "openai" || value === "gemini";
}

function hashToken(token: string): number {
  let hash = 0;

  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) | 0;
  }

  return hash;
}
