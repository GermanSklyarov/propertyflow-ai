import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
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
  PropertyPriceHistory,
  GeneratedPropertyDescription,
  PropertyImageAnalysisResult,
  PropertySearchResponse,
  RentalYieldSummary,
  RunListingAssistantResponse
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
import { PropertyAiAssetsService } from "../../application/services/property-ai-assets.service.js";
import { PropertyComparisonService } from "../../application/services/property-comparison.service.js";
import { RentalYieldService } from "../../application/services/rental-yield.service.js";
import { ComparePropertiesDto } from "./compare-properties.dto.js";
import { CreatePropertyDto } from "./create-property.dto.js";
import { IndexedSearchPropertiesDto, toIndexedPropertySearchRequest } from "./indexed-search-properties.dto.js";
import { NaturalLanguageSearchDto } from "./natural-language-search.dto.js";
import { RunListingAssistantDto } from "./run-listing-assistant.dto.js";
import { ReviewAiAssetDto } from "./review-ai-asset.dto.js";
import { SearchPropertiesDto, toPropertySearchRequest } from "./search-properties.dto.js";

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
    @Inject(PropertyAiAssetsService)
    private readonly aiAssets: PropertyAiAssetsService,
    @Inject(PropertyComparisonService)
    private readonly propertyComparison: PropertyComparisonService,
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

  @Get(":propertyId/advisor")
  advisorSummary(@TenantId() tenantId: string, @Param("propertyId") propertyId: string): Promise<AiAdvisorSummary> {
    return this.advisor.summarize(tenantId, propertyId);
  }

  @Get(":propertyId/ai-assets")
  aiAssetsSummary(@TenantId() tenantId: string, @Param("propertyId") propertyId: string): Promise<PropertyAiAssets> {
    return this.aiAssets.getByPropertyId(tenantId, propertyId);
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
