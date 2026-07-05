import { Body, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { ApiExtraModels, ApiHeader, ApiTags } from "@nestjs/swagger";
import type { BackgroundJobMonitorResponse, BackgroundJobSnapshot, RequestUser } from "@propertyflow/contracts";
import { AuditService } from "../../../audit/application/audit.service.js";
import { CurrentUser } from "../../../shared/auth/request-user.decorator.js";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { JobQueueService } from "../../application/job-queue.service.js";
import {
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
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  @Post()
  @Roles("broker", "manager", "admin")
  enqueue(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: EnqueueBackgroundJobDto
  ): Promise<BackgroundJobSnapshot> {
    const request = withTenantJobContext(tenantId, user.id, payload);

    return this.jobs.enqueue(request.name, request.payload).then(async (job) => {
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
    });
  }

  @Get()
  @Roles("broker", "manager", "admin")
  list(@TenantId() tenantId: string, @Query() query: ListJobsDto): Promise<BackgroundJobMonitorResponse> {
    const filters = toListJobsQuery(query);

    return this.jobs.list(tenantId, filters.states, filters.limit);
  }
}
