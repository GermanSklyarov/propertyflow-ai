import { BadRequestException, CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import type { TenantSnapshot } from "@propertyflow/contracts";
import { TenantService } from "../../tenants/application/tenant.service.js";

interface TenantAwareRequest {
  headers: Record<string, string | string[] | undefined>;
  tenant?: TenantSnapshot;
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenants: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantAwareRequest>();
    const value = request.headers["x-tenant-id"];
    const tenantId = Array.isArray(value) ? value[0] : value;

    if (!tenantId) {
      throw new BadRequestException("Missing required x-tenant-id header");
    }

    const tenant = await this.tenants.findActiveTenant(tenantId);

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    request.tenant = tenant;

    return true;
  }
}

