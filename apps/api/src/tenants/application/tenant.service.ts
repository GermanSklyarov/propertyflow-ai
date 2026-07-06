import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { TenantSnapshot, UpdateTenantSettingsRequest } from "@propertyflow/contracts";
import { TENANT_REPOSITORY, type TenantRepository } from "../domain/tenant.repository.js";

@Injectable()
export class TenantService {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository) {}

  async findActiveTenant(tenantId: string): Promise<TenantSnapshot | null> {
    const tenant = await this.tenants.findById(tenantId);

    if (!tenant || tenant.status !== "active") {
      return null;
    }

    return tenant;
  }

  async getActiveTenantOrThrow(tenantId: string): Promise<TenantSnapshot> {
    const tenant = await this.findActiveTenant(tenantId);

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }

  async updateSettings(tenantId: string, request: UpdateTenantSettingsRequest): Promise<TenantSnapshot> {
    const tenant = await this.tenants.updateSettings(tenantId, request);

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }
}
