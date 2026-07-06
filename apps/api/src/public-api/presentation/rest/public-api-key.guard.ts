import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { PublicApiKeySnapshot } from "@propertyflow/contracts";
import { PublicApiKeyService } from "../../application/public-api-key.service.js";

interface PublicApiRequest {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
  publicApiKey?: PublicApiKeySnapshot;
}

@Injectable()
export class PublicApiKeyGuard implements CanActivate {
  constructor(@Inject(PublicApiKeyService) private readonly apiKeys: PublicApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PublicApiRequest>();
    const value = request.headers["x-api-key"];
    const apiKeyValue = Array.isArray(value) ? value[0] : value;

    if (!apiKeyValue) {
      throw new UnauthorizedException("Missing x-api-key header");
    }

    const apiKey = await this.apiKeys.authenticate(apiKeyValue);

    if (!apiKey || !apiKey.scopes.includes("properties:read")) {
      throw new UnauthorizedException("Invalid API key");
    }

    request.publicApiKey = apiKey;
    await this.apiKeys.recordUsage(apiKey, `${request.method ?? "GET"} ${request.url ?? "unknown"}`);

    return true;
  }
}
