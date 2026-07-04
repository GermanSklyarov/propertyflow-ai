import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { PublicApiKeySnapshot } from "@propertyflow/contracts";

interface PublicApiRequest {
  publicApiKey?: PublicApiKeySnapshot;
}

export const PublicApiKey = createParamDecorator((_data: unknown, context: ExecutionContext): PublicApiKeySnapshot => {
  const request = context.switchToHttp().getRequest<PublicApiRequest>();

  if (!request.publicApiKey) {
    throw new Error("PublicApiKeyGuard did not attach API key to request");
  }

  return request.publicApiKey;
});

