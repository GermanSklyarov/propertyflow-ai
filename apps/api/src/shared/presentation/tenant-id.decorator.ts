import { BadRequestException, createParamDecorator, type ExecutionContext } from "@nestjs/common";

export const TenantId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
  const value = request.headers["x-tenant-id"];
  const tenantId = Array.isArray(value) ? value[0] : value;

  if (!tenantId) {
    throw new BadRequestException("Missing required x-tenant-id header");
  }

  return tenantId;
});

