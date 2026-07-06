import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { BackgroundJobName, EnqueueBackgroundJobRequest, RequestUser, UserRole } from "@propertyflow/contracts";

const roleRank: Record<UserRole, number> = {
  agent: 1,
  broker: 2,
  manager: 3,
  admin: 4
};

const minimumRoleByJob: Record<BackgroundJobName, UserRole> = {
  "knowledge.chunks.embed": "manager",
  "knowledge.documents.ingest": "manager",
  "concierge.model.train": "manager",
  "pricing.model.train": "manager",
  "properties.import": "broker",
  "properties.ai_description.generate": "broker",
  "properties.images.analyze": "broker",
  "properties.search.index": "broker"
};

const locales = ["en", "ru", "th", "zh"] as const;
const importSources = ["csv", "json", "partner-api"] as const;
const searchIndexReasons = ["created", "updated", "manual"] as const;
const embeddingProviders = ["local-hash", "openai", "anthropic", "gemini"] as const;
const pricingAlgorithms = ["baseline-refresh", "catboost", "lightgbm"] as const;
const conciergeAlgorithms = ["baseline-refresh", "llm-reranker", "learning-to-rank"] as const;

@Injectable()
export class BackgroundJobPolicyService {
  authorize(user: RequestUser, request: EnqueueBackgroundJobRequest): void {
    const requiredRole = minimumRoleByJob[request.name];

    if (roleRank[user.role] < roleRank[requiredRole]) {
      throw new ForbiddenException(`Job ${request.name} requires role ${requiredRole} or higher`);
    }

    this.validatePayload(request);
  }

  private validatePayload(request: EnqueueBackgroundJobRequest): void {
    const payload = request.payload as unknown;

    if (!isRecord(payload)) {
      throw new BadRequestException("Job payload must be an object");
    }

    switch (request.name) {
      case "knowledge.chunks.embed":
        this.requireEnum(payload, "provider", embeddingProviders);
        this.requireString(payload, "model");
        this.requireInteger(payload, "dimensions", 1, 4096);
        this.optionalInteger(payload, "limit", 1, 500);
        this.optionalString(payload, "documentId");
        return;
      case "knowledge.documents.ingest":
        this.requireString(payload, "documentId");
        this.requireEnum(payload, "reason", searchIndexReasons);
        return;
      case "concierge.model.train":
        this.requireString(payload, "modelVersion");
        this.requireEnum(payload, "algorithm", conciergeAlgorithms);
        this.optionalBoolean(payload, "dryRun");
        return;
      case "pricing.model.train":
        this.requireString(payload, "modelVersion");
        this.requireEnum(payload, "algorithm", pricingAlgorithms);
        this.optionalBoolean(payload, "dryRun");
        return;
      case "properties.import":
        this.requireEnum(payload, "source", importSources);
        this.optionalString(payload, "objectUrl");
        this.optionalBoolean(payload, "dryRun");
        return;
      case "properties.ai_description.generate":
        this.requireString(payload, "propertyId");
        this.requireEnumArray(payload, "locales", locales);
        return;
      case "properties.images.analyze":
        this.requireString(payload, "propertyId");
        this.requireStringArray(payload, "imageUrls");
        this.optionalStringArray(payload, "imageIds");
        if (
          Array.isArray(payload.imageIds) &&
          Array.isArray(payload.imageUrls) &&
          payload.imageIds.length !== payload.imageUrls.length
        ) {
          throw new BadRequestException("imageIds must match imageUrls length when provided");
        }
        return;
      case "properties.search.index":
        this.requireString(payload, "propertyId");
        this.requireEnum(payload, "reason", searchIndexReasons);
        return;
    }
  }

  private requireString(payload: Record<string, unknown>, key: string): void {
    if (typeof payload[key] !== "string" || payload[key].length === 0) {
      throw new BadRequestException(`${key} must be a non-empty string`);
    }
  }

  private optionalString(payload: Record<string, unknown>, key: string): void {
    if (payload[key] !== undefined && (typeof payload[key] !== "string" || payload[key].length === 0)) {
      throw new BadRequestException(`${key} must be a non-empty string`);
    }
  }

  private requireStringArray(payload: Record<string, unknown>, key: string): void {
    if (!Array.isArray(payload[key]) || payload[key].length === 0 || !payload[key].every(isNonEmptyString)) {
      throw new BadRequestException(`${key} must be a non-empty string array`);
    }
  }

  private optionalStringArray(payload: Record<string, unknown>, key: string): void {
    if (payload[key] !== undefined && (!Array.isArray(payload[key]) || !payload[key].every(isNonEmptyString))) {
      throw new BadRequestException(`${key} must be a string array`);
    }
  }

  private requireEnum<T extends readonly string[]>(payload: Record<string, unknown>, key: string, values: T): void {
    if (typeof payload[key] !== "string" || !values.includes(payload[key])) {
      throw new BadRequestException(`${key} must be one of: ${values.join(", ")}`);
    }
  }

  private requireEnumArray<T extends readonly string[]>(payload: Record<string, unknown>, key: string, values: T): void {
    if (!Array.isArray(payload[key]) || payload[key].length === 0 || !payload[key].every((value) => values.includes(value))) {
      throw new BadRequestException(`${key} must be a non-empty array of: ${values.join(", ")}`);
    }
  }

  private requireInteger(payload: Record<string, unknown>, key: string, min: number, max: number): void {
    if (!Number.isInteger(payload[key]) || Number(payload[key]) < min || Number(payload[key]) > max) {
      throw new BadRequestException(`${key} must be an integer between ${min} and ${max}`);
    }
  }

  private optionalInteger(payload: Record<string, unknown>, key: string, min: number, max: number): void {
    if (payload[key] !== undefined) {
      this.requireInteger(payload, key, min, max);
    }
  }

  private optionalBoolean(payload: Record<string, unknown>, key: string): void {
    if (payload[key] !== undefined && typeof payload[key] !== "boolean") {
      throw new BadRequestException(`${key} must be a boolean`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
