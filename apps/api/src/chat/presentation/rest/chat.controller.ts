import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type { AiChatResponse, RequestUser } from "@propertyflow/contracts";
import { AuditService } from "../../../audit/application/audit.service.js";
import { SearchObservabilityService } from "../../../search-observability/application/search-observability.service.js";
import { CurrentUser } from "../../../shared/auth/request-user.decorator.js";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { AiChatService } from "../../application/ai-chat.service.js";
import { AiChatDto } from "./ai-chat.dto.js";

@ApiTags("chat")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: true })
@ApiHeader({ name: "x-user-role", required: true })
@Controller("chat")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class ChatController {
  constructor(
    @Inject(AiChatService) private readonly chat: AiChatService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SearchObservabilityService) private readonly searchObservability: SearchObservabilityService
  ) {}

  @Post()
  @Roles("agent", "broker", "manager", "admin")
  async ask(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: AiChatDto
  ): Promise<AiChatResponse> {
    const startedAt = Date.now();
    const result = await this.chat.ask(tenantId, payload);

    await this.audit.record({
      tenantId,
      user,
      action: "chat.asked",
      resourceType: "search",
      metadata: {
        message: payload.message,
        propertyId: payload.propertyId,
        matchedPropertyIds: result.matchedPropertyIds,
        citationCount: result.citations.length
      }
    });

    await this.searchObservability.record({
      tenantId,
      user,
      source: "ai",
      query: payload.message,
      filters: {
        propertyId: payload.propertyId,
        market: payload.market,
        purpose: payload.purpose
      },
      totalResults: result.matchedPropertyIds.length,
      latencyMs: Date.now() - startedAt
    });

    return result;
  }
}
