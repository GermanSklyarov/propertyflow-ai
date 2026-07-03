import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { TenantSnapshot } from "@propertyflow/contracts";

interface TenantAwareRequest {
  tenant?: TenantSnapshot;
}

export const Tenant = createParamDecorator((_data: unknown, context: ExecutionContext): TenantSnapshot => {
  const request = context.switchToHttp().getRequest<TenantAwareRequest>();

  if (!request.tenant) {
    throw new Error("TenantGuard did not attach tenant to request");
  }

  return request.tenant;
});

