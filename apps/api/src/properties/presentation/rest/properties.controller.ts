import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type {
  AiAdvisorSummary,
  InvestmentAnalysis,
  IndexedPropertySearchResponse,
  NaturalLanguagePropertySearchResponse,
  NeighborhoodIntelligence,
  PropertyAiAssets,
  PropertyComparisonResponse,
  PropertyImageGalleryResponse,
  PropertyImageSnapshot,
  PropertyPriceHistory,
  CreatePropertyImageUploadResponse,
  GeneratedPropertyDescription,
  PropertyImageAnalysisResult,
  PropertyPriceRecommendation,
  PropertySearchResponse,
  PropertyStatusHistoryResponse,
  RentalYieldSummary,
  RunListingAssistantResponse,
  UpdatePropertyPriceResponse
} from "@propertyflow/contracts";
import type { RequestUser } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { AuditService } from "../../../audit/application/audit.service.js";
import { JobQueueService } from "../../../jobs/application/job-queue.service.js";
import { RealtimePublisherService } from "../../../realtime/application/realtime-publisher.service.js";
import { SearchObservabilityService } from "../../../search-observability/application/search-observability.service.js";
import { CurrentUser } from "../../../shared/auth/request-user.decorator.js";
import { Roles } from "../../../shared/auth/roles.decorator.js";
import { RolesGuard } from "../../../shared/auth/roles.guard.js";
import { UserContextGuard } from "../../../shared/auth/user-context.guard.js";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { TenantGuard } from "../../../shared/presentation/tenant.guard.js";
import { CreatePropertyCommand } from "../../application/commands/create-property.command.js";
import { GetPropertyQuery } from "../../application/queries/get-property.query.js";
import { ListPropertiesQuery } from "../../application/queries/list-properties.query.js";
import { AiPropertyAdvisorService } from "../../application/services/ai-property-advisor.service.js";
import { IndexedPropertySearchService } from "../../application/services/indexed-property-search.service.js";
import { InvestmentCalculatorService } from "../../application/services/investment-calculator.service.js";
import { ListingAssistantService } from "../../application/services/listing-assistant.service.js";
import { NaturalLanguagePropertySearchService } from "../../application/services/natural-language-property-search.service.js";
import { NeighborhoodIntelligenceService } from "../../application/services/neighborhood-intelligence.service.js";
import { PriceHistoryService } from "../../application/services/price-history.service.js";
import { PriceRecommendationService } from "../../application/services/price-recommendation.service.js";
import { PropertyAiAssetsService } from "../../application/services/property-ai-assets.service.js";
import { PropertyComparisonService } from "../../application/services/property-comparison.service.js";
import { PropertyImagesService } from "../../application/services/property-images.service.js";
import { PropertyPublicationService } from "../../application/services/property-publication.service.js";
import { RentalYieldService } from "../../application/services/rental-yield.service.js";
import { AddPropertyImageDto } from "./add-property-image.dto.js";
import { ConfirmPropertyImageUploadDto } from "./confirm-property-image-upload.dto.js";
import { ComparePropertiesDto } from "./compare-properties.dto.js";
import { CreatePropertyDto } from "./create-property.dto.js";
import { CreatePropertyImageUploadDto } from "./create-property-image-upload.dto.js";
import { IndexedSearchPropertiesDto, toIndexedPropertySearchRequest } from "./indexed-search-properties.dto.js";
import { NaturalLanguageSearchDto } from "./natural-language-search.dto.js";
import { RunListingAssistantDto } from "./run-listing-assistant.dto.js";
import { ReviewAiAssetDto } from "./review-ai-asset.dto.js";
import { SearchPropertiesDto, toPropertySearchRequest } from "./search-properties.dto.js";
import { UpdatePropertyPriceDto } from "./update-property-price.dto.js";
import { UpdatePropertyStatusDto } from "./update-property-status.dto.js";

@Controller("properties")
@ApiTags("properties")
@ApiHeader({ name: "x-tenant-id", required: true })
@ApiHeader({ name: "x-user-id", required: false })
@ApiHeader({ name: "x-user-role", required: false })
@UseGuards(TenantGuard, UserContextGuard, RolesGuard)
export class PropertiesController {
  constructor(
    @Inject(CommandBus)
    private readonly commandBus: CommandBus,
    @Inject(QueryBus)
    private readonly queryBus: QueryBus,
    @Inject(AiPropertyAdvisorService)
    private readonly advisor: AiPropertyAdvisorService,
    @Inject(IndexedPropertySearchService)
    private readonly indexedSearch: IndexedPropertySearchService,
    @Inject(InvestmentCalculatorService)
    private readonly investmentCalculator: InvestmentCalculatorService,
    @Inject(ListingAssistantService)
    private readonly listingAssistant: ListingAssistantService,
    @Inject(NaturalLanguagePropertySearchService)
    private readonly naturalLanguageSearch: NaturalLanguagePropertySearchService,
    @Inject(NeighborhoodIntelligenceService)
    private readonly neighborhoodIntelligence: NeighborhoodIntelligenceService,
    @Inject(PriceHistoryService)
    private readonly priceHistory: PriceHistoryService,
    @Inject(PriceRecommendationService)
    private readonly priceRecommendation: PriceRecommendationService,
    @Inject(PropertyAiAssetsService)
    private readonly aiAssets: PropertyAiAssetsService,
    @Inject(PropertyComparisonService)
    private readonly propertyComparison: PropertyComparisonService,
    @Inject(PropertyImagesService)
    private readonly propertyImages: PropertyImagesService,
    @Inject(PropertyPublicationService)
    private readonly publication: PropertyPublicationService,
    @Inject(RentalYieldService)
    private readonly rentalYield: RentalYieldService,
    @Inject(AuditService)
    private readonly audit: AuditService,
    @Inject(JobQueueService)
    private readonly jobs: JobQueueService,
    @Inject(RealtimePublisherService)
    private readonly realtime: RealtimePublisherService,
    @Inject(SearchObservabilityService)
    private readonly searchObservability: SearchObservabilityService
  ) {}

  @Post()
  @Roles("agent", "broker", "manager", "admin")
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: CreatePropertyDto
  ): Promise<PropertySnapshot> {
    const property = await this.commandBus.execute<CreatePropertyCommand, PropertySnapshot>(
      new CreatePropertyCommand(tenantId, payload)
    );

    await this.audit.record({
      tenantId,
      user,
      action: "property.created",
      resourceType: "property",
      resourceId: property.id,
      metadata: {
        market: property.market,
        price: property.price,
        kind: property.kind
      }
    });

    this.realtime.publish(tenantId, "property.created", {
      propertyId: property.id,
      title: property.title,
      market: property.market,
      status: property.status
    });

    await this.jobs.enqueue("properties.search.index", {
      tenantId,
      requestedByUserId: user.id,
      propertyId: property.id,
      reason: "created"
    });

    return property;
  }

  @Get()
  async list(@TenantId() tenantId: string, @Query() query: SearchPropertiesDto): Promise<PropertySearchResponse> {
    const startedAt = Date.now();
    const filters = toPropertySearchRequest(query);
    const result = await this.queryBus.execute<ListPropertiesQuery, PropertySearchResponse>(
      new ListPropertiesQuery(tenantId, filters)
    );

    await this.searchObservability.record({
      tenantId,
      source: "structured",
      filters,
      totalResults: result.total,
      latencyMs: Date.now() - startedAt
    });

    return result;
  }

  @Get("search-index")
  async searchIndex(
    @TenantId() tenantId: string,
    @Query() query: IndexedSearchPropertiesDto
  ): Promise<IndexedPropertySearchResponse> {
    const startedAt = Date.now();
    const filters = toIndexedPropertySearchRequest(query);
    const result = await this.indexedSearch.search(tenantId, filters);

    await this.searchObservability.record({
      tenantId,
      source: "indexed",
      query: filters.query,
      filters,
      totalResults: result.total,
      latencyMs: Date.now() - startedAt
    });

    return result;
  }

  @Post("ai-search")
  @Roles("agent", "broker", "manager", "admin")
  async aiSearch(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: NaturalLanguageSearchDto
  ): Promise<NaturalLanguagePropertySearchResponse> {
    const startedAt = Date.now();
    const result = await this.naturalLanguageSearch.search(tenantId, payload);

    await this.audit.record({
      tenantId,
      user,
      action: "property.ai_search",
      resourceType: "search",
      metadata: {
        query: payload.query,
        locale: payload.locale,
        filters: result.filters,
        total: result.total
      }
    });

    await this.searchObservability.record({
      tenantId,
      user,
      source: "ai",
      query: payload.query,
      filters: result.filters,
      totalResults: result.total,
      latencyMs: Date.now() - startedAt
    });

    return result;
  }

  @Post("compare")
  @Roles("agent", "broker", "manager", "admin")
  async compare(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: ComparePropertiesDto
  ): Promise<PropertyComparisonResponse> {
    const result = await this.propertyComparison.compare(tenantId, payload);

    await this.audit.record({
      tenantId,
      user,
      action: "property.compared",
      resourceType: "comparison",
      metadata: {
        propertyIds: payload.propertyIds,
        winners: result.winners
      }
    });

    return result;
  }

  @Post(":propertyId/ai-assistant")
  @Roles("agent", "broker", "manager", "admin")
  async runListingAssistant(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Body() payload: RunListingAssistantDto
  ): Promise<RunListingAssistantResponse> {
    const result = await this.listingAssistant.run(tenantId, propertyId, payload, user);

    await this.audit.record({
      tenantId,
      user,
      action: "property.ai_assistant",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        jobs: result.jobs.map((job) => ({
          id: job.id,
          name: job.name
        }))
      }
    });

    return result;
  }

  @Post(":propertyId/publish")
  @Roles("broker", "manager", "admin")
  async publish(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string
  ): Promise<PropertySnapshot> {
    const result = await this.publication.publish(tenantId, propertyId, user);
    const property = result.property;

    const job = await this.jobs.enqueue("properties.search.index", {
      tenantId,
      requestedByUserId: user.id,
      propertyId,
      reason: "updated"
    });

    await this.audit.record({
      tenantId,
      user,
      action: "property.published",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        previousStatus: result.previousStatus,
        status: property.status,
        changed: result.changed,
        jobId: job.id
      }
    });

    this.realtime.publish(tenantId, "property.published", {
      propertyId,
      title: property.title,
      market: property.market,
      status: property.status
    });

    return property;
  }

  @Patch(":propertyId/status")
  @Roles("broker", "manager", "admin")
  async updateStatus(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Body() payload: UpdatePropertyStatusDto
  ): Promise<PropertySnapshot> {
    const result = await this.publication.changeStatus(tenantId, propertyId, payload.status, user, payload.note);
    const property = result.property;

    const job = await this.jobs.enqueue("properties.search.index", {
      tenantId,
      requestedByUserId: user.id,
      propertyId,
      reason: "updated"
    });

    await this.audit.record({
      tenantId,
      user,
      action: "property.status_changed",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        previousStatus: result.previousStatus,
        status: property.status,
        changed: result.changed,
        note: payload.note,
        jobId: job.id
      }
    });

    this.realtime.publish(tenantId, "property.status_changed", {
      propertyId,
      title: property.title,
      market: property.market,
      previousStatus: result.previousStatus,
      status: property.status
    });

    return property;
  }

  @Get(":propertyId/status-history")
  @Roles("agent", "broker", "manager", "admin")
  statusHistory(
    @TenantId() tenantId: string,
    @Param("propertyId") propertyId: string
  ): Promise<PropertyStatusHistoryResponse> {
    return this.publication.getStatusHistory(tenantId, propertyId);
  }

  @Patch(":propertyId/price")
  @Roles("agent", "broker", "manager", "admin")
  async updatePrice(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Body() payload: UpdatePropertyPriceDto
  ): Promise<UpdatePropertyPriceResponse> {
    const result = await this.priceHistory.updatePrice(tenantId, propertyId, payload.price);

    const job = await this.jobs.enqueue("properties.search.index", {
      tenantId,
      requestedByUserId: user.id,
      propertyId,
      reason: "updated"
    });

    await this.audit.record({
      tenantId,
      user,
      action: "property.price_updated",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        price: result.property.price,
        note: payload.note,
        jobId: job.id
      }
    });

    this.realtime.publish(tenantId, "property.price_updated", {
      propertyId,
      title: result.property.title,
      market: result.property.market,
      price: result.property.price
    });

    return result;
  }

  @Get(":propertyId/advisor")
  advisorSummary(@TenantId() tenantId: string, @Param("propertyId") propertyId: string): Promise<AiAdvisorSummary> {
    return this.advisor.summarize(tenantId, propertyId);
  }

  @Get(":propertyId/ai-assets")
  aiAssetsSummary(@TenantId() tenantId: string, @Param("propertyId") propertyId: string): Promise<PropertyAiAssets> {
    return this.aiAssets.getByPropertyId(tenantId, propertyId);
  }

  @Get(":propertyId/images")
  images(@TenantId() tenantId: string, @Param("propertyId") propertyId: string): Promise<PropertyImageGalleryResponse> {
    return this.propertyImages.getGallery(tenantId, propertyId);
  }

  @Post(":propertyId/images/upload-url")
  @Roles("agent", "broker", "manager", "admin")
  createImageUploadUrl(
    @TenantId() tenantId: string,
    @Param("propertyId") propertyId: string,
    @Body() payload: CreatePropertyImageUploadDto
  ): Promise<CreatePropertyImageUploadResponse> {
    return this.propertyImages.createUploadUrl(tenantId, propertyId, payload);
  }

  @Post(":propertyId/images/confirm-upload")
  @Roles("agent", "broker", "manager", "admin")
  async confirmImageUpload(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Body() payload: ConfirmPropertyImageUploadDto
  ): Promise<PropertyImageSnapshot> {
    const image = await this.propertyImages.confirmUpload(tenantId, propertyId, payload);

    const job = await this.jobs.enqueue("properties.search.index", {
      tenantId,
      requestedByUserId: user.id,
      propertyId,
      reason: "updated"
    });
    const analysisJob =
      payload.analyzeImage === false
        ? undefined
        : await this.jobs.enqueue("properties.images.analyze", {
            tenantId,
            requestedByUserId: user.id,
            propertyId,
            imageUrls: [image.imageUrl],
            imageIds: [image.id]
          });

    await this.audit.record({
      tenantId,
      user,
      action: "property.image_added",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        imageId: image.id,
        bucket: image.bucket,
        objectKey: image.objectKey,
        imageUrl: image.imageUrl,
        position: image.position,
        jobId: job.id,
        analysisJobId: analysisJob?.id
      }
    });

    this.realtime.publish(tenantId, "property.images_updated", {
      propertyId,
      action: "added",
      imageId: image.id,
      imageUrl: image.imageUrl
    });

    return image;
  }

  @Post(":propertyId/images")
  @Roles("agent", "broker", "manager", "admin")
  async addImage(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Body() payload: AddPropertyImageDto
  ): Promise<PropertyImageSnapshot> {
    const image = await this.propertyImages.addImage(tenantId, propertyId, payload);

    const job = await this.jobs.enqueue("properties.search.index", {
      tenantId,
      requestedByUserId: user.id,
      propertyId,
      reason: "updated"
    });
    const analysisJob =
      payload.analyzeImage === false
        ? undefined
        : await this.jobs.enqueue("properties.images.analyze", {
            tenantId,
            requestedByUserId: user.id,
            propertyId,
            imageUrls: [image.imageUrl],
            imageIds: [image.id]
          });

    await this.audit.record({
      tenantId,
      user,
      action: "property.image_added",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        imageId: image.id,
        imageUrl: image.imageUrl,
        position: image.position,
        jobId: job.id,
        analysisJobId: analysisJob?.id
      }
    });

    this.realtime.publish(tenantId, "property.images_updated", {
      propertyId,
      action: "added",
      imageId: image.id,
      imageUrl: image.imageUrl
    });

    return image;
  }

  @Delete(":propertyId/images/:imageId")
  @Roles("agent", "broker", "manager", "admin")
  async removeImage(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Param("imageId") imageId: string
  ): Promise<PropertyImageSnapshot> {
    const image = await this.propertyImages.removeImage(tenantId, propertyId, imageId);

    const job = await this.jobs.enqueue("properties.search.index", {
      tenantId,
      requestedByUserId: user.id,
      propertyId,
      reason: "updated"
    });

    await this.audit.record({
      tenantId,
      user,
      action: "property.image_removed",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        imageId: image.id,
        imageUrl: image.imageUrl,
        jobId: job.id
      }
    });

    this.realtime.publish(tenantId, "property.images_updated", {
      propertyId,
      action: "removed",
      imageId: image.id
    });

    return image;
  }

  @Post(":propertyId/ai-assets/descriptions/:assetId/review")
  @Roles("agent", "broker", "manager", "admin")
  async reviewDescriptionAsset(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Param("assetId") assetId: string,
    @Body() payload: ReviewAiAssetDto
  ): Promise<GeneratedPropertyDescription> {
    const result = await this.aiAssets.reviewDescription(tenantId, propertyId, assetId, payload, user);

    await this.audit.record({
      tenantId,
      user,
      action: "property.ai_asset_reviewed",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        assetType: "description",
        assetId,
        status: payload.status
      }
    });

    return result;
  }

  @Post(":propertyId/ai-assets/descriptions/:assetId/apply")
  @Roles("agent", "broker", "manager", "admin")
  async applyDescriptionAsset(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Param("assetId") assetId: string
  ): Promise<PropertySnapshot> {
    const property = await this.aiAssets.applyApprovedDescription(tenantId, propertyId, assetId);

    const job = await this.jobs.enqueue("properties.search.index", {
      tenantId,
      requestedByUserId: user.id,
      propertyId,
      reason: "updated"
    });

    await this.audit.record({
      tenantId,
      user,
      action: "property.ai_description_applied",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        assetId,
        jobId: job.id
      }
    });

    return property;
  }

  @Post(":propertyId/ai-assets/image-analysis/:assetId/review")
  @Roles("agent", "broker", "manager", "admin")
  async reviewImageAnalysisAsset(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Param("assetId") assetId: string,
    @Body() payload: ReviewAiAssetDto
  ): Promise<PropertyImageAnalysisResult> {
    const result = await this.aiAssets.reviewImageAnalysis(tenantId, propertyId, assetId, payload, user);

    await this.audit.record({
      tenantId,
      user,
      action: "property.ai_asset_reviewed",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        assetType: "image-analysis",
        assetId,
        status: payload.status
      }
    });

    return result;
  }

  @Post(":propertyId/ai-assets/image-analysis/:assetId/apply")
  @Roles("agent", "broker", "manager", "admin")
  async applyImageAnalysisAsset(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Param("assetId") assetId: string
  ): Promise<PropertySnapshot> {
    const result = await this.aiAssets.applyApprovedImageAnalysis(tenantId, propertyId, assetId);

    const job = await this.jobs.enqueue("properties.search.index", {
      tenantId,
      requestedByUserId: user.id,
      propertyId,
      reason: "updated"
    });

    await this.audit.record({
      tenantId,
      user,
      action: "property.ai_image_analysis_applied",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        assetId,
        addedAmenities: result.addedAmenities,
        jobId: job.id
      }
    });

    this.realtime.publish(tenantId, "property.amenities_updated", {
      propertyId,
      amenities: result.property.amenities,
      addedAmenities: result.addedAmenities,
      source: "ai-image-analysis",
      assetId
    });

    return result.property;
  }

  @Get(":propertyId/investment")
  investment(@TenantId() tenantId: string, @Param("propertyId") propertyId: string): Promise<InvestmentAnalysis> {
    return this.investmentCalculator.analyze(tenantId, propertyId);
  }

  @Get(":propertyId/neighborhood")
  neighborhood(
    @TenantId() tenantId: string,
    @Param("propertyId") propertyId: string
  ): Promise<NeighborhoodIntelligence> {
    return this.neighborhoodIntelligence.analyze(tenantId, propertyId);
  }

  @Get(":propertyId/price-history")
  priceHistorySummary(
    @TenantId() tenantId: string,
    @Param("propertyId") propertyId: string
  ): Promise<PropertyPriceHistory> {
    return this.priceHistory.getHistory(tenantId, propertyId);
  }

  @Get(":propertyId/price-recommendation")
  @Roles("agent", "broker", "manager", "admin")
  async priceRecommendationSummary(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string
  ): Promise<PropertyPriceRecommendation> {
    const result = await this.priceRecommendation.recommend(tenantId, propertyId);

    await this.audit.record({
      tenantId,
      user,
      action: "property.price_recommended",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        suggestedPrice: result.suggestedPrice,
        position: result.position,
        confidence: result.confidence,
        comparablePropertyIds: result.comparableProperties.map((property) => property.propertyId)
      }
    });

    return result;
  }

  @Get(":propertyId/rental-yield")
  rentalYieldSummary(
    @TenantId() tenantId: string,
    @Param("propertyId") propertyId: string
  ): Promise<RentalYieldSummary> {
    return this.rentalYield.summarize(tenantId, propertyId);
  }

  @Get(":propertyId")
  get(@TenantId() tenantId: string, @Param("propertyId") propertyId: string): Promise<PropertySnapshot> {
    return this.queryBus.execute(new GetPropertyQuery(tenantId, propertyId));
  }
}
