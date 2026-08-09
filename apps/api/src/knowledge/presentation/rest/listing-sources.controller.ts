import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type {
  BackgroundJobSnapshot,
  ListingSourceListResponse,
  ListingSourcePreviewResponse,
  ListingSourceSnapshot,
  RequestUser
} from "@propertyflow/contracts";
import { AuditService } from "../../../audit/application/audit.service.js";
import { CurrentUser } from "../../../shared/auth/request-user.decorator.js";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { ListingSourceService } from "../../application/listing-source.service.js";
import { CreateListingSourceDto, UpdateListingSourceScheduleDto } from "./create-listing-source.dto.js";

@ApiTags("knowledge")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: true })
@ApiHeader({ name: "x-user-role", required: true })
@Controller("listing-sources")
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class ListingSourcesController {
  constructor(
    @Inject(ListingSourceService) private readonly listingSources: ListingSourceService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  @Get()
  @Roles("agent", "broker", "manager", "admin")
  list(@TenantId() tenantId: string): Promise<ListingSourceListResponse> {
    return this.listingSources.list(tenantId);
  }

  @Post("rest")
  @Roles("manager", "admin")
  async createRestSource(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: CreateListingSourceDto
  ): Promise<ListingSourceSnapshot> {
    const source = await this.listingSources.create(tenantId, {
      ...payload,
      type: "rest-api"
    });

    await this.audit.record({
      tenantId,
      user,
      action: "knowledge.listing_source_created",
      resourceType: "knowledge",
      resourceId: source.id,
      metadata: {
        name: source.name,
        type: source.type,
        importMode: source.importMode,
        canonicalFields: Object.keys(source.mapping.canonical),
        customAttributeKeys: source.mapping.customAttributes?.map((attribute) => attribute.key) ?? []
      }
    });

    return source;
  }

  @Post("rest/preview")
  @Roles("manager", "admin")
  previewRestSource(
    @TenantId() tenantId: string,
    @Body() payload: CreateListingSourceDto
  ): Promise<ListingSourcePreviewResponse> {
    return this.listingSources.preview(tenantId, {
      ...payload,
      type: "rest-api"
    });
  }

  @Post(":sourceId/sync")
  @Roles("manager", "admin")
  async sync(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("sourceId") sourceId: string
  ): Promise<BackgroundJobSnapshot> {
    const job = await this.listingSources.sync(tenantId, user.id, sourceId);

    await this.audit.record({
      tenantId,
      user,
      action: "knowledge.listing_source_sync_requested",
      resourceType: "knowledge",
      resourceId: sourceId,
      metadata: {
        jobId: job.id
      }
    });

    return job;
  }

  @Patch(":sourceId/schedule")
  @Roles("manager", "admin")
  async updateSchedule(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("sourceId") sourceId: string,
    @Body() payload: UpdateListingSourceScheduleDto
  ): Promise<ListingSourceSnapshot> {
    const source = await this.listingSources.updateSchedule(tenantId, sourceId, payload.syncInterval);

    await this.audit.record({
      tenantId,
      user,
      action: "knowledge.listing_source_sync_requested",
      resourceType: "knowledge",
      resourceId: sourceId,
      metadata: {
        name: source.name,
        syncInterval: source.syncInterval,
        nextSyncAt: source.nextSyncAt
      }
    });

    return source;
  }
}
