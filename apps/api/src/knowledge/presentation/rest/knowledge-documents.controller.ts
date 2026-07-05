import { Body, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type { KnowledgeDocumentListResponse, KnowledgeDocumentSnapshot, RequestUser } from "@propertyflow/contracts";
import { AuditService } from "../../../audit/application/audit.service.js";
import { CurrentUser } from "../../../shared/auth/request-user.decorator.js";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { KnowledgeDocumentService } from "../../application/knowledge-document.service.js";
import { CreateKnowledgeDocumentDto } from "./create-knowledge-document.dto.js";
import { ListKnowledgeDocumentsDto } from "./list-knowledge-documents.dto.js";

@ApiTags("knowledge")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: true })
@ApiHeader({ name: "x-user-role", required: true })
@Controller("knowledge-documents")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class KnowledgeDocumentsController {
  constructor(
    @Inject(KnowledgeDocumentService) private readonly knowledge: KnowledgeDocumentService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  @Get()
  @Roles("agent", "broker", "manager", "admin")
  search(
    @TenantId() tenantId: string,
    @Query() query: ListKnowledgeDocumentsDto
  ): Promise<KnowledgeDocumentListResponse> {
    return this.knowledge.search(tenantId, query);
  }

  @Post()
  @Roles("manager", "admin")
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: CreateKnowledgeDocumentDto
  ): Promise<KnowledgeDocumentSnapshot> {
    const document = await this.knowledge.create(tenantId, payload);

    await this.audit.record({
      tenantId,
      user,
      action: "knowledge.document_created",
      resourceType: "knowledge",
      resourceId: document.id,
      metadata: {
        title: document.title,
        locale: document.locale,
        kind: document.kind,
        tags: document.tags
      }
    });

    return document;
  }
}
