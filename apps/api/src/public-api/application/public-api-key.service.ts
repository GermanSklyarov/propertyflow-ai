import { createHash } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { PublicApiKeySnapshot } from "@propertyflow/contracts";
import {
  PUBLIC_API_KEY_REPOSITORY,
  type PublicApiKeyRepository
} from "../domain/public-api-key.repository.js";

@Injectable()
export class PublicApiKeyService {
  constructor(@Inject(PUBLIC_API_KEY_REPOSITORY) private readonly apiKeys: PublicApiKeyRepository) {}

  async authenticate(rawApiKey: string): Promise<PublicApiKeySnapshot | null> {
    const keyHash = createHash("sha256").update(rawApiKey).digest("hex");
    const apiKey = await this.apiKeys.findActiveByHash(keyHash);

    if (apiKey) {
      await this.apiKeys.markUsed(apiKey.id);
    }

    return apiKey;
  }

  async recordUsage(apiKey: PublicApiKeySnapshot, route: string): Promise<void> {
    await this.apiKeys.recordUsage(apiKey.tenantId, apiKey.id, route);
  }

  async assertWithinMonthlyRequestLimit(apiKey: PublicApiKeySnapshot): Promise<void> {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const usage = await this.apiKeys.getPublicApiMonthlyUsage(apiKey.tenantId, periodStart, periodEnd);

    if (usage.limit > 0 && usage.used >= usage.limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "Public API monthly request limit exceeded",
          usage: {
            key: "publicApiRequestsMonthly",
            used: usage.used,
            limit: usage.limit,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString()
          }
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }
}
