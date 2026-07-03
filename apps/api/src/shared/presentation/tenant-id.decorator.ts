import { BadRequestException, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { TenantSnapshot } from "@propertyflow/contracts";

interface TenantAwareRequest {
  headers: Record<string, string | string[] | undefined>;
  tenant?: TenantSnapshot;
}

export const TenantId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<TenantAwareRequest>();

  if (request.tenant) {
    return request.tenant.id;
  }

  const value = request.headers["x-tenant-id"];
  const tenantId = Array.isArray(value) ? value[0] : value;

  if (!tenantId) {
    throw new BadRequestException("Missing required x-tenant-id header");
  }

  return tenantId;
});
