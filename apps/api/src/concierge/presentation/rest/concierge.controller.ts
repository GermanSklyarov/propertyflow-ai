import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type {
  BackgroundJobSnapshot,
  ConciergeAnalyticsResponse,
  ConciergeFeedbackSnapshot,
  ConciergeModelRegistryResponse,
  ConciergeResponse,
  ConciergeSessionDetailResponse,
  ConciergeSessionListResponse,
  ConciergeTrainingDatasetResponse,
  LeadSnapshot,
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
import { AiConciergeService } from "../../application/ai-concierge.service.js";
import {
  AddConciergeSessionMessageDto,
  ConciergeRequestDto,
  ConciergeTrainingDatasetDto,
  CreateLeadFromConciergeSessionDto,
  ListConciergeSessionsDto,
  SubmitConciergeFeedbackDto,
  TrainConciergeModelDto
} from "./concierge.dto.js";

@ApiTags("concierge")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: true })
@ApiHeader({ name: "x-user-role", required: true })
@Controller("concierge")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class ConciergeController {
  constructor(
    @Inject(AiConciergeService) private readonly concierge: AiConciergeService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(JobQueueService) private readonly jobs: JobQueueService
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

  @Post("sessions")
  @Roles("agent", "broker", "manager", "admin")
  async createSession(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: ConciergeRequestDto
  ): Promise<ConciergeSessionDetailResponse> {
    const detail = await this.concierge.createSession(tenantId, user.id, payload);

    await this.audit.record({
      tenantId,
      user,
      action: "concierge.session_created",
      resourceType: "search",
      resourceId: detail.session.id,
      metadata: {
        status: detail.session.status,
        market: detail.session.profile.market,
        purpose: detail.session.profile.purpose,
        questions: detail.session.latestResponse.nextQuestions.map((question) => question.id)
      }
    });

    return detail;
  }

  @Get("sessions")
  @Roles("agent", "broker", "manager", "admin")
  listSessions(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListConciergeSessionsDto
  ): Promise<ConciergeSessionListResponse> {
    return this.concierge.listSessions(tenantId, {
      ...query,
      userId: user.role === "agent" ? user.id : query.userId
    });
  }

  @Get("analytics")
  @Roles("agent", "broker", "manager", "admin")
  getAnalytics(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListConciergeSessionsDto
  ): Promise<ConciergeAnalyticsResponse> {
    return this.concierge.getAnalytics(tenantId, {
      ...query,
      userId: user.role === "agent" ? user.id : query.userId
    });
  }

  @Get("model-registry")
  @Roles("agent", "broker", "manager", "admin")
  modelRegistry(): ConciergeModelRegistryResponse {
    return this.concierge.registry();
  }

  @Post("model/train")
  @Roles("manager", "admin")
  async trainModel(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: TrainConciergeModelDto
  ): Promise<BackgroundJobSnapshot> {
    const job = await this.jobs.enqueue("concierge.model.train", {
      tenantId,
      requestedByUserId: user.id,
      modelVersion: payload.modelVersion,
      algorithm: payload.algorithm,
      dryRun: payload.dryRun
    });

    await this.audit.record({
      tenantId,
      user,
      action: "concierge.model_training_requested",
      resourceType: "job",
      resourceId: job.id,
      metadata: {
        modelVersion: payload.modelVersion,
        algorithm: payload.algorithm,
        dryRun: payload.dryRun ?? false
      }
    });

    return job;
  }

  @Get("training-dataset")
  @Roles("manager", "admin")
  async getTrainingDataset(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Query() query: ConciergeTrainingDatasetDto
  ): Promise<ConciergeTrainingDatasetResponse> {
    const result = await this.concierge.getTrainingDataset(tenantId, query);

    await this.audit.record({
      tenantId,
      user,
      action: "concierge.training_dataset_viewed",
      resourceType: "search",
      metadata: {
        total: result.total,
        rating: query.rating,
        convertedOnly: query.convertedOnly ?? false
      }
    });

    return result;
  }

  @Post("sessions/:sessionId/messages")
  @Roles("agent", "broker", "manager", "admin")
  async addMessage(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("sessionId") sessionId: string,
    @Body() payload: AddConciergeSessionMessageDto
  ): Promise<ConciergeSessionDetailResponse> {
    const detail = await this.concierge.addSessionMessage(tenantId, sessionId, payload);

    await this.audit.record({
      tenantId,
      user,
      action: "concierge.message_added",
      resourceType: "search",
      resourceId: detail.session.id,
      metadata: {
        status: detail.session.status,
        market: detail.session.profile.market,
        purpose: detail.session.profile.purpose,
        area: detail.session.latestResponse.areaRecommendation?.area,
        recommendedPropertyIds: detail.session.latestResponse.propertyRecommendations.map((property) => property.propertyId)
      }
    });

    return detail;
  }

  @Get("sessions/:sessionId")
  @Roles("agent", "broker", "manager", "admin")
  getSession(
    @TenantId() tenantId: string,
    @Param("sessionId") sessionId: string
  ): Promise<ConciergeSessionDetailResponse> {
    return this.concierge.getSession(tenantId, sessionId);
  }

  @Post("sessions/:sessionId/lead")
  @Roles("agent", "broker", "manager", "admin")
  async createLead(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("sessionId") sessionId: string,
    @Body() payload: CreateLeadFromConciergeSessionDto
  ): Promise<LeadSnapshot> {
    const lead = await this.concierge.createLeadFromSession(tenantId, sessionId, payload, user);

    await this.audit.record({
      tenantId,
      user,
      action: "concierge.lead_created",
      resourceType: "lead",
      resourceId: lead.id,
      metadata: {
        sessionId,
        propertyId: lead.propertyId,
        assignedAgentId: lead.assignedAgentId
      }
    });

    return lead;
  }

  @Post("sessions/:sessionId/feedback")
  @Roles("agent", "broker", "manager", "admin")
  async submitFeedback(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("sessionId") sessionId: string,
    @Body() payload: SubmitConciergeFeedbackDto
  ): Promise<ConciergeFeedbackSnapshot> {
    const feedback = await this.concierge.submitFeedback(tenantId, sessionId, payload, user);

    await this.audit.record({
      tenantId,
      user,
      action: "concierge.feedback_submitted",
      resourceType: "search",
      resourceId: sessionId,
      metadata: {
        feedbackId: feedback.id,
        rating: feedback.rating,
        areaAccurate: feedback.areaAccurate,
        propertyRecommendationsUseful: feedback.propertyRecommendationsUseful,
        selectedPropertyId: feedback.selectedPropertyId
      }
    });

    return feedback;
  }
}
