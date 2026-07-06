import { Body, Controller, Get, HttpException, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { ApiExtraModels, ApiHeader, ApiTags } from "@nestjs/swagger";
import type { BackgroundJobMonitorResponse, BackgroundJobSnapshot, RequestUser } from "@propertyflow/contracts";
import { AuditService } from "../../../audit/application/audit.service.js";
import { CurrentUser } from "../../../shared/auth/request-user.decorator.js";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { BackgroundJobPolicyService } from "../../application/background-job-policy.service.js";
import { JobQueueService } from "../../application/job-queue.service.js";
import {
  ConciergeModelTrainPayloadDto,
  EnqueueBackgroundJobDto,
  KnowledgeChunkEmbeddingPayloadDto,
  KnowledgeDocumentIngestPayloadDto,
  PricingModelTrainPayloadDto,
  PropertyAiDescriptionPayloadDto,
  PropertyImageAnalysisPayloadDto,
  PropertyImportPayloadDto,
  PropertySearchIndexPayloadDto,
  withTenantJobContext
} from "./enqueue-background-job.dto.js";
import { ListJobsDto, toListJobsQuery } from "./list-jobs.dto.js";

@ApiTags("jobs")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: true })
@ApiHeader({ name: "x-user-role", required: true })
@ApiExtraModels(
  KnowledgeChunkEmbeddingPayloadDto,
  KnowledgeDocumentIngestPayloadDto,
  ConciergeModelTrainPayloadDto,
  PropertyImportPayloadDto,
  PricingModelTrainPayloadDto,
  PropertyAiDescriptionPayloadDto,
  PropertyImageAnalysisPayloadDto,
  PropertySearchIndexPayloadDto
)
@Controller("jobs")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class JobsController {
  constructor(
    @Inject(JobQueueService) private readonly jobs: JobQueueService,
    @Inject(BackgroundJobPolicyService) private readonly jobPolicy: BackgroundJobPolicyService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  @Post()
  @Roles("broker", "manager", "admin")
  async enqueue(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: EnqueueBackgroundJobDto
  ): Promise<BackgroundJobSnapshot> {
    const request = withTenantJobContext(tenantId, user.id, payload);

    try {
      this.jobPolicy.authorize(user, request);
    } catch (error) {
      await this.auditRejectedJob(tenantId, user, request, error);
      throw error;
    }

    const job = await this.jobs.enqueue(request.name, request.payload);

    await this.audit.record({
      tenantId,
      user,
      action: "job.enqueued",
      resourceType: "job",
      resourceId: job.id,
      metadata: {
        name: job.name,
        queue: job.queue
      }
    });

    return job;
  }

  private async auditRejectedJob(
    tenantId: string,
    user: RequestUser,
    request: ReturnType<typeof withTenantJobContext>,
    error: unknown
  ): Promise<void> {
    await this.audit.record({
      tenantId,
      user,
      action: "job.enqueue_rejected",
      resourceType: "job",
      resourceId: request.name,
      metadata: {
        name: request.name,
        statusCode: error instanceof HttpException ? error.getStatus() : 500,
        reason: error instanceof Error ? error.message : "Unknown job policy rejection"
      }
    });
  }

  @Get()
  @Roles("broker", "manager", "admin")
  list(@TenantId() tenantId: string, @Query() query: ListJobsDto): Promise<BackgroundJobMonitorResponse> {
    const filters = toListJobsQuery(query);

    return this.jobs.list(tenantId, filters.states, filters.limit);
  }
}
