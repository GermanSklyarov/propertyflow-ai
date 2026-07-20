import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  PublicWidgetConfigResponse,
  TenantSnapshot,
  TenantUsageMetric,
  TenantUsageResponse,
  UpdateTenantSettingsRequest
} from "@propertyflow/contracts";
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

  async getPublicWidgetConfig(slug: string): Promise<PublicWidgetConfigResponse> {
    const tenant = await this.tenants.findBySlug(slug);

    if (!tenant || tenant.status !== "active") {
      throw new NotFoundException("Widget tenant not found");
    }

    return {
      aiName: "Anna",
      branding: tenant.branding,
      conciergeMode: tenant.subscriptionPlan,
      languages: ["en", "ru", "th", "zh"],
      tenantSlug: tenant.slug,
      welcomeMessage: "Hi! I'm Anna, your AI property consultant."
    };
  }

  async getUsage(tenantId: string): Promise<TenantUsageResponse> {
    const tenant = await this.getActiveTenantOrThrow(tenantId);
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const usage = await this.tenants.getUsage(tenantId, periodStart, periodEnd);

    return {
      tenantId,
      subscriptionPlan: tenant.subscriptionPlan,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      items: [
        this.toUsageMetric("properties", usage.properties, tenant.limits.properties),
        this.toUsageMetric("agents", usage.agents, tenant.limits.agents),
        this.toUsageMetric("aiCreditsMonthly", usage.aiCreditsMonthly, tenant.limits.aiCreditsMonthly),
        this.toUsageMetric(
          "publicApiRequestsMonthly",
          usage.publicApiRequestsMonthly,
          tenant.limits.publicApiRequestsMonthly
        )
      ],
      generatedAt: now.toISOString()
    };
  }

  async updateSettings(tenantId: string, request: UpdateTenantSettingsRequest): Promise<TenantSnapshot> {
    const tenant = await this.tenants.updateSettings(tenantId, request);

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }

  private toUsageMetric(key: TenantUsageMetric["key"], used: number, limit: number): TenantUsageMetric {
    return {
      key,
      used,
      limit,
      remaining: Math.max(limit - used, 0),
      utilizationRate: limit > 0 ? Math.round((used / limit) * 10_000) / 100 : 0
    };
  }
}
