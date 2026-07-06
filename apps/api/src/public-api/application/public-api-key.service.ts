import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
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
}
