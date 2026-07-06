import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type { ConciergeResponse, RequestUser } from "@propertyflow/contracts";
import { AuditService } from "../../../audit/application/audit.service.js";
import { CurrentUser } from "../../../shared/auth/request-user.decorator.js";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { AiConciergeService } from "../../application/ai-concierge.service.js";
import { ConciergeRequestDto } from "./concierge.dto.js";

@ApiTags("concierge")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: true })
@ApiHeader({ name: "x-user-role", required: true })
@Controller("concierge")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class ConciergeController {
  constructor(
    @Inject(AiConciergeService) private readonly concierge: AiConciergeService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  @Post("advise")
  @Roles("agent", "broker", "manager", "admin")
  async advise(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: ConciergeRequestDto
  ): Promise<ConciergeResponse> {
    const response = await this.concierge.advise(tenantId, payload);

    await this.audit.record({
      tenantId,
      user,
      action: "concierge.advised",
      resourceType: "search",
      resourceId: response.id,
      metadata: {
        stage: response.stage,
        market: response.profile.market,
        purpose: response.profile.purpose,
        area: response.areaRecommendation?.area,
        questions: response.nextQuestions.map((question) => question.id),
        recommendedPropertyIds: response.propertyRecommendations.map((property) => property.propertyId)
      }
    });

    return response;
  }
}
