import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type {
  BackgroundJobSnapshot,
  KnowledgeDocumentListResponse,
  KnowledgeDocumentSnapshot,
  RequestUser
} from "@propertyflow/contracts";
import { AuditService } from "../../../audit/application/audit.service.js";
import { JobQueueService } from "../../../jobs/application/job-queue.service.js";
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
    @Inject(JobQueueService) private readonly jobs: JobQueueService,
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
    const ingestJob = await this.enqueueIngestion(tenantId, user.id, document.id, "created");

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
        tags: document.tags,
        ingestionJobId: ingestJob.id
      }
    });

    return document;
  }

  @Post(":documentId/ingest")
  @Roles("manager", "admin")
  async ingest(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("documentId") documentId: string
  ): Promise<BackgroundJobSnapshot> {
    const job = await this.enqueueIngestion(tenantId, user.id, documentId, "manual");

    await this.audit.record({
      tenantId,
      user,
      action: "knowledge.document_ingestion_requested",
      resourceType: "knowledge",
      resourceId: documentId,
      metadata: {
        jobId: job.id,
        reason: "manual"
      }
    });

    return job;
  }

  private enqueueIngestion(
    tenantId: string,
    requestedByUserId: string | undefined,
    documentId: string,
    reason: "created" | "updated" | "manual"
  ): Promise<BackgroundJobSnapshot> {
    return this.jobs.enqueue("knowledge.documents.ingest", {
      tenantId,
      requestedByUserId,
      documentId,
      reason
    });
  }
}
