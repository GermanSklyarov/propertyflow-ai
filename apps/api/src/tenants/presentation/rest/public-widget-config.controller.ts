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
        aiNames: {
          en: "Anna",
          ru: "Анна",
          th: "มาลี",
          zh: "安娜"
        },
        branding: {
          displayName: "Demo Agency",
          primaryColor: "#0f766e"
        },
        conciergeMode: "starter",
        languages: ["en", "ru", "th", "zh"],
        personaGenders: {
          en: "feminine",
          ru: "feminine",
          th: "feminine",
          zh: "neutral"
        },
        tenantSlug: "demo-agency",
        tone: "friendly",
        welcomeMessage: "Hi! I'm Anna, your AI property consultant.",
        welcomeMessages: {
          en: "Hi! I'm Anna, your AI property consultant.",
          ru: "Привет! Я Анна, ваш AI-консультант по недвижимости.",
          th: "สวัสดีค่ะ ฉันชื่อ Anna ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ",
          zh: "你好！我是 Anna，你的 AI 房产顾问。"
        }
      }
    }
  })
  getConfig(@Param("tenantSlug") tenantSlug: string): Promise<PublicWidgetConfigResponse> {
    return this.tenants.getPublicWidgetConfig(tenantSlug);
  }
}
