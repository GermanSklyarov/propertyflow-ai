import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type { PublicWidgetConfigResponse } from "@propertyflow/contracts";
import { TenantService } from "../../application/tenant.service.js";

@Controller("public/v1/widget")
@ApiTags("public-widget")
export class PublicWidgetConfigController {
  constructor(@Inject(TenantService) private readonly tenants: TenantService) {}

  @Get("config/:tenantSlug")
  @ApiOperation({ summary: "Get public AI Concierge widget configuration for a tenant slug" })
  @ApiParam({ name: "tenantSlug", example: "demo-agency" })
  @ApiOkResponse({
    description: "Public widget launcher configuration",
    schema: {
      example: {
        aiName: "Anna",
        branding: {
          displayName: "Demo Agency",
          primaryColor: "#0f766e"
        },
        conciergeMode: "starter",
        languages: ["en", "ru", "th", "zh"],
        tenantSlug: "demo-agency",
        welcomeMessage: "Hi! I'm Anna, your AI property consultant."
      }
    }
  })
  getConfig(@Param("tenantSlug") tenantSlug: string): Promise<PublicWidgetConfigResponse> {
    return this.tenants.getPublicWidgetConfig(tenantSlug);
  }
}
