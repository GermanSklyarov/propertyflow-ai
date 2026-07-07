import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiHeader, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type {
  AiAdvisorSummary,
  BackgroundJobSnapshot,
  InvestmentAnalysis,
  IndexedPropertySearchResponse,
  NaturalLanguagePropertySearchResponse,
  NeighborhoodIntelligence,
  LeadListResponse,
  LeadSnapshot,
  PricingModelRegistryResponse,
  PricingTrainingDatasetResponse,
  PropertyAiAssets,
  PropertyComparisonResponse,
  PropertyImageDeletePreviewResponse,
  PropertyImageGalleryResponse,
  PropertyImageSnapshot,
  PropertyPriceHistory,
  CreatePropertyImageUploadResponse,
  GeneratedPropertyDescription,
  PropertyImageAnalysisResult,
  PropertyPriceRecommendation,
  PropertyPriceRecommendationFeedbackSnapshot,
  PropertySearchResponse,
  PropertyStatusHistoryResponse,
  RentalYieldSummary,
  RunListingAssistantResponse,
  SavedSearchAlertAnalyticsResponse,
  SavedSearchAlertRunListResponse,
  SavedSearchAlertRunSnapshot,
  SavedSearchLeadFunnelResponse,
  SavedSearchOpportunitiesResponse,
  SavedSearchLeadAnalyticsResponse,
  SavedPropertySearchAlertsResponse,
  SavedPropertySearchListResponse,
  SavedPropertySearchMatchesResponse,
  SavedPropertySearchRecommendationsResponse,
  SavedPropertySearchSnapshot,
  UpdatePropertyPriceResponse
} from "@propertyflow/contracts";
import type { RequestUser } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { AuditService } from "../../../audit/application/audit.service.js";
import { JobQueueService } from "../../../jobs/application/job-queue.service.js";
import { LeadService } from "../../../leads/application/lead.service.js";
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
import { PriceRecommendationFeedbackService } from "../../application/services/price-recommendation-feedback.service.js";
import { PriceRecommendationService } from "../../application/services/price-recommendation.service.js";
import { PropertyAiAssetsService } from "../../application/services/property-ai-assets.service.js";
import { PropertyComparisonService } from "../../application/services/property-comparison.service.js";
import { PropertyImagesService } from "../../application/services/property-images.service.js";
import { PropertyPublicationService } from "../../application/services/property-publication.service.js";
import { RentalYieldService } from "../../application/services/rental-yield.service.js";
import { SavedPropertySearchService } from "../../application/services/saved-property-search.service.js";
import { AddPropertyImageDto } from "./add-property-image.dto.js";
import { ConfirmPropertyImageDeleteDto } from "./confirm-property-image-delete.dto.js";
import { ConfirmPropertyImageUploadDto } from "./confirm-property-image-upload.dto.js";
import { ComparePropertiesDto } from "./compare-properties.dto.js";
import { CreateLeadFromSavedSearchDto } from "./create-lead-from-saved-search.dto.js";
import { CreatePropertyDto } from "./create-property.dto.js";
import { CreatePropertyImageUploadDto } from "./create-property-image-upload.dto.js";
import { CreateSavedPropertySearchDto } from "./create-saved-property-search.dto.js";
import { CreateSavedSearchAlertDigestJobDto } from "./create-saved-search-alert-digest-job.dto.js";
import { IndexedSearchPropertiesDto, toIndexedPropertySearchRequest } from "./indexed-search-properties.dto.js";
import { ListSavedSearchAlertRunsDto } from "./list-saved-search-alert-runs.dto.js";
import { ListSavedSearchOpportunitiesDto } from "./list-saved-search-opportunities.dto.js";
import { NaturalLanguageSearchDto } from "./natural-language-search.dto.js";
import { RunListingAssistantDto } from "./run-listing-assistant.dto.js";
import { ReviewAiAssetDto } from "./review-ai-asset.dto.js";
import { SearchPropertiesDto, toPropertySearchRequest } from "./search-properties.dto.js";
import { SubmitPriceRecommendationFeedbackDto } from "./submit-price-recommendation-feedback.dto.js";
import { TrainPricingModelDto } from "./train-pricing-model.dto.js";
import { UpdatePropertyPriceDto } from "./update-property-price.dto.js";
import { UpdateSavedPropertySearchNotificationsDto } from "./update-saved-property-search-notifications.dto.js";
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
    @Inject(PriceRecommendationFeedbackService)
    private readonly priceRecommendationFeedback: PriceRecommendationFeedbackService,
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
    @Inject(SavedPropertySearchService)
    private readonly savedSearches: SavedPropertySearchService,
    @Inject(AuditService)
    private readonly audit: AuditService,
    @Inject(JobQueueService)
    private readonly jobs: JobQueueService,
    @Inject(LeadService)
    private readonly leads: LeadService,
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

  @Post("saved-searches")
  @Roles("agent", "broker", "manager", "admin")
  async createSavedSearch(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: CreateSavedPropertySearchDto
  ): Promise<SavedPropertySearchSnapshot> {
    const savedSearch = await this.savedSearches.create(tenantId, user, payload);

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.created",
      resourceType: "search",
      resourceId: savedSearch.id,
      metadata: {
        title: savedSearch.title,
        naturalLanguageQuery: savedSearch.naturalLanguageQuery,
        filters: savedSearch.filters,
        matchCount: savedSearch.matchCount,
        notificationsEnabled: savedSearch.notificationsEnabled
      }
    });

    return savedSearch;
  }

  @Get("saved-searches")
  @Roles("agent", "broker", "manager", "admin")
  listSavedSearches(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser
  ): Promise<SavedPropertySearchListResponse> {
    return this.savedSearches.list(tenantId, user);
  }

  @Get("saved-searches/lead-analytics")
  @ApiOperation({ summary: "Return saved-search lead conversion funnel" })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        totalSavedSearches: { type: "number", example: 12 },
        savedSearchLeads: { type: "number", example: 5 },
        savedSearchLeadConversionRate: { type: "number", example: 41.67 },
        topSavedSearches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              savedSearch: { type: "object" },
              leadCount: { type: "number", example: 2 },
              conversionRate: { type: "number", example: 100 },
              latestLeadAt: { type: "string", format: "date-time" }
            },
            required: ["savedSearch", "leadCount", "conversionRate"]
          }
        },
        generatedAt: { type: "string", format: "date-time" }
      },
      required: [
        "totalSavedSearches",
        "savedSearchLeads",
        "savedSearchLeadConversionRate",
        "topSavedSearches",
        "generatedAt"
      ]
    }
  })
  @Roles("agent", "broker", "manager", "admin")
  async getSavedSearchLeadFunnel(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser
  ): Promise<SavedSearchLeadFunnelResponse> {
    const result = await this.savedSearches.getLeadFunnel(tenantId, user);

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.lead_funnel_viewed",
      resourceType: "search",
      metadata: {
        totalSavedSearches: result.totalSavedSearches,
        savedSearchLeads: result.savedSearchLeads,
        topSavedSearchIds: result.topSavedSearches.map((item) => item.savedSearch.id)
      }
    });

    return result;
  }

  @Get("saved-searches/opportunities")
  @ApiOperation({ summary: "Return saved-search follow-up opportunities" })
  @ApiQuery({ name: "limit", required: false, type: Number, minimum: 1, maximum: 50 })
  @ApiQuery({ name: "minScore", required: false, type: Number, minimum: 0, maximum: 100 })
  @ApiQuery({ name: "includeConverted", required: false, type: Boolean })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              savedSearch: { type: "object" },
              currentMatchCount: { type: "number", example: 4 },
              leadCount: { type: "number", example: 0 },
              opportunityScore: { type: "number", example: 87 },
              reason: { type: "string" },
              latestLeadAt: { type: "string", format: "date-time" },
              topRecommendation: { type: "object" }
            },
            required: ["savedSearch", "currentMatchCount", "leadCount", "opportunityScore", "reason"]
          }
        },
        total: { type: "number", example: 3 },
        generatedAt: { type: "string", format: "date-time" }
      },
      required: ["items", "total", "generatedAt"]
    }
  })
  @Roles("agent", "broker", "manager", "admin")
  async listSavedSearchOpportunities(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListSavedSearchOpportunitiesDto
  ): Promise<SavedSearchOpportunitiesResponse> {
    const result = await this.savedSearches.listOpportunities(tenantId, user, query);

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.opportunities_viewed",
      resourceType: "search",
      metadata: {
        total: result.total,
        limit: query.limit,
        minScore: query.minScore,
        includeConverted: query.includeConverted,
        savedSearchIds: result.items.map((item) => item.savedSearch.id)
      }
    });

    return result;
  }

  @Get("saved-searches/alerts")
  @ApiOperation({ summary: "Return enabled saved-search alerts with current recommendations" })
  @Roles("agent", "broker", "manager", "admin")
  async listSavedSearchAlerts(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser
  ): Promise<SavedPropertySearchAlertsResponse> {
    const result = await this.savedSearches.listAlerts(tenantId, user);

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.alerts_viewed",
      resourceType: "search",
      metadata: {
        total: result.total,
        savedSearchIds: result.items.map((item) => item.savedSearch.id)
      }
    });

    return result;
  }

  @Get("saved-searches/alerts/analytics")
  @ApiOperation({ summary: "Return saved-search alert dashboard analytics" })
  @Roles("agent", "broker", "manager", "admin")
  async getSavedSearchAlertAnalytics(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser
  ): Promise<SavedSearchAlertAnalyticsResponse> {
    const result = await this.savedSearches.getAlertAnalytics(tenantId, user);

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.alert_analytics_viewed",
      resourceType: "search",
      metadata: {
        enabledAlerts: result.enabledAlerts,
        recentRuns: result.recentRuns,
        totalCandidates: result.totalCandidates
      }
    });

    return result;
  }

  @Get("saved-searches/alerts/runs")
  @ApiOperation({ summary: "List saved-search alert digest runs" })
  @Roles("agent", "broker", "manager", "admin")
  async listSavedSearchAlertRuns(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListSavedSearchAlertRunsDto
  ): Promise<SavedSearchAlertRunListResponse> {
    const result = await this.savedSearches.listAlertRuns(tenantId, user, query.limit);

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.alert_runs_viewed",
      resourceType: "search",
      metadata: {
        total: result.total,
        limit: query.limit
      }
    });

    return result;
  }

  @Get("saved-searches/alerts/runs/:runId")
  @ApiOperation({ summary: "Get one saved-search alert digest run" })
  @Roles("agent", "broker", "manager", "admin")
  async getSavedSearchAlertRun(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("runId") runId: string
  ): Promise<SavedSearchAlertRunSnapshot> {
    const run = await this.savedSearches.getAlertRunById(tenantId, runId, user);

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.alert_run_viewed",
      resourceType: "search",
      resourceId: run.id,
      metadata: {
        status: run.status,
        totalAlerts: run.totalAlerts,
        totalCandidates: run.totalCandidates
      }
    });

    return run;
  }

  @Post("saved-searches/alerts/digest-job")
  @ApiOperation({ summary: "Enqueue a saved-search alert digest job for the current user" })
  @Roles("agent", "broker", "manager", "admin")
  async createSavedSearchAlertDigestJob(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: CreateSavedSearchAlertDigestJobDto
  ): Promise<BackgroundJobSnapshot> {
    const job = await this.jobs.enqueue("saved_search.alerts.digest", {
      tenantId,
      requestedByUserId: user.id,
      scope: "user",
      userId: user.id,
      dryRun: payload.dryRun ?? true,
      limit: payload.limit
    });

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.alert_digest_requested",
      resourceType: "job",
      resourceId: job.id,
      metadata: {
        name: job.name,
        scope: "user",
        dryRun: payload.dryRun ?? true,
        limit: payload.limit
      }
    });

    return job;
  }

  @Get("saved-searches/:searchId")
  @Roles("agent", "broker", "manager", "admin")
  async getSavedSearch(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("searchId") searchId: string
  ): Promise<SavedPropertySearchSnapshot> {
    const savedSearch = await this.savedSearches.getById(tenantId, searchId, user);

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.viewed",
      resourceType: "search",
      resourceId: savedSearch.id,
      metadata: {
        title: savedSearch.title,
        matchCount: savedSearch.matchCount
      }
    });

    return savedSearch;
  }

  @Get("saved-searches/:searchId/matches")
  @ApiOperation({ summary: "Return current property matches for a saved search" })
  @Roles("agent", "broker", "manager", "admin")
  async getSavedSearchMatches(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("searchId") searchId: string
  ): Promise<SavedPropertySearchMatchesResponse> {
    const startedAt = Date.now();
    const result = await this.savedSearches.getMatches(tenantId, searchId, user);

    await this.searchObservability.record({
      tenantId,
      source: "structured",
      query: result.savedSearch.naturalLanguageQuery,
      filters: result.filters,
      totalResults: result.total,
      latencyMs: Date.now() - startedAt
    });

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.matches_viewed",
      resourceType: "search",
      resourceId: result.savedSearch.id,
      metadata: {
        title: result.savedSearch.title,
        filters: result.filters,
        total: result.total
      }
    });

    return result;
  }

  @Get("saved-searches/:searchId/recommendations")
  @ApiOperation({ summary: "Rank saved search matches with reasons and tradeoffs" })
  @Roles("agent", "broker", "manager", "admin")
  async getSavedSearchRecommendations(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("searchId") searchId: string
  ): Promise<SavedPropertySearchRecommendationsResponse> {
    const startedAt = Date.now();
    const result = await this.savedSearches.getRecommendations(tenantId, searchId, user);

    await this.searchObservability.record({
      tenantId,
      source: "structured",
      query: result.savedSearch.naturalLanguageQuery,
      filters: result.savedSearch.filters,
      totalResults: result.totalCandidates,
      latencyMs: Date.now() - startedAt
    });

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.recommendations_viewed",
      resourceType: "search",
      resourceId: result.savedSearch.id,
      metadata: {
        title: result.savedSearch.title,
        totalCandidates: result.totalCandidates,
        recommendedPropertyIds: result.recommendations.map((recommendation) => recommendation.property.id)
      }
    });

    return result;
  }

  @Patch("saved-searches/:searchId/notifications")
  @ApiOperation({ summary: "Enable or disable notifications for a saved search" })
  @Roles("agent", "broker", "manager", "admin")
  async updateSavedSearchNotifications(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("searchId") searchId: string,
    @Body() payload: UpdateSavedPropertySearchNotificationsDto
  ): Promise<SavedPropertySearchSnapshot> {
    const savedSearch = await this.savedSearches.updateNotifications(
      tenantId,
      searchId,
      user,
      payload.notificationsEnabled
    );

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.notifications_updated",
      resourceType: "search",
      resourceId: savedSearch.id,
      metadata: {
        title: savedSearch.title,
        notificationsEnabled: savedSearch.notificationsEnabled
      }
    });

    return savedSearch;
  }

  @Post("saved-searches/:searchId/lead")
  @ApiOperation({ summary: "Create a CRM lead from a saved search" })
  @Roles("agent", "broker", "manager", "admin")
  async createLeadFromSavedSearch(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("searchId") searchId: string,
    @Body() payload: CreateLeadFromSavedSearchDto
  ): Promise<LeadSnapshot> {
    const matches = await this.savedSearches.getMatches(tenantId, searchId, user);
    const recommendations = await this.savedSearches.getRecommendations(tenantId, searchId, user);
    const selectedPropertyId = payload.propertyId ?? recommendations.recommendations[0]?.property.id;

    if (selectedPropertyId && !matches.items.some((property) => property.id === selectedPropertyId)) {
      throw new BadRequestException("propertyId must belong to the saved search matches");
    }

    const lead = await this.leads.create(
      tenantId,
      {
        propertyId: selectedPropertyId,
        source: "saved-search",
        contactName: payload.contactName,
        contactEmail: payload.contactEmail,
        contactPhone: payload.contactPhone,
        preferredLocale: payload.preferredLocale ?? matches.savedSearch.locale,
        assignedAgentId: payload.assignedAgentId ?? user.id,
        message: payload.message ?? this.buildSavedSearchLeadMessage(matches.savedSearch.title, selectedPropertyId),
        attributionSearchEventId: matches.savedSearch.id,
        attributionSearchQuery: matches.savedSearch.naturalLanguageQuery ?? matches.savedSearch.title,
        attributionSearchSource: "structured"
      },
      user
    );

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.lead_created",
      resourceType: "search",
      resourceId: matches.savedSearch.id,
      metadata: {
        leadId: lead.id,
        propertyId: lead.propertyId,
        title: matches.savedSearch.title
      }
    });

    return lead;
  }

  @Get("saved-searches/:searchId/leads/analytics")
  @ApiOperation({ summary: "Return lead conversion analytics for a saved search" })
  @Roles("agent", "broker", "manager", "admin")
  async getSavedSearchLeadAnalytics(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("searchId") searchId: string
  ): Promise<SavedSearchLeadAnalyticsResponse> {
    const savedSearch = await this.savedSearches.getById(tenantId, searchId, user);
    const result = await this.leads.getAttributionAnalytics(tenantId, savedSearch.id);

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.lead_analytics_viewed",
      resourceType: "search",
      resourceId: savedSearch.id,
      metadata: {
        title: savedSearch.title,
        totalLeads: result.totalLeads
      }
    });

    return result;
  }

  @Get("saved-searches/:searchId/leads")
  @ApiOperation({ summary: "List CRM leads attributed to a saved search" })
  @Roles("agent", "broker", "manager", "admin")
  async listSavedSearchLeads(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("searchId") searchId: string
  ): Promise<LeadListResponse> {
    const savedSearch = await this.savedSearches.getById(tenantId, searchId, user);
    const result = await this.leads.listByAttribution(tenantId, savedSearch.id);

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.leads_viewed",
      resourceType: "search",
      resourceId: savedSearch.id,
      metadata: {
        title: savedSearch.title,
        total: result.total
      }
    });

    return result;
  }

  @Delete("saved-searches/:searchId")
  @Roles("agent", "broker", "manager", "admin")
  async deleteSavedSearch(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("searchId") searchId: string
  ): Promise<SavedPropertySearchSnapshot> {
    const savedSearch = await this.savedSearches.delete(tenantId, searchId, user);

    await this.audit.record({
      tenantId,
      user,
      action: "saved_search.deleted",
      resourceType: "search",
      resourceId: savedSearch.id,
      metadata: {
        title: savedSearch.title,
        matchCount: savedSearch.matchCount
      }
    });

    return savedSearch;
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

  @Get("price-recommendation/training-dataset")
  @Roles("manager", "admin")
  async pricingTrainingDataset(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser
  ): Promise<PricingTrainingDatasetResponse> {
    const result = await this.priceRecommendationFeedback.trainingDataset(tenantId);

    await this.audit.record({
      tenantId,
      user,
      action: "property.price_training_dataset_viewed",
      resourceType: "property",
      metadata: {
        total: result.total
      }
    });

    return result;
  }

  @Get("price-recommendation/model-registry")
  @Roles("agent", "broker", "manager", "admin")
  pricingModelRegistry(): PricingModelRegistryResponse {
    return this.priceRecommendation.registry();
  }

  @Post("price-recommendation/train")
  @Roles("manager", "admin")
  async trainPricingModel(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() payload: TrainPricingModelDto
  ): Promise<BackgroundJobSnapshot> {
    const job = await this.jobs.enqueue("pricing.model.train", {
      tenantId,
      requestedByUserId: user.id,
      modelVersion: payload.modelVersion,
      algorithm: payload.algorithm,
      dryRun: payload.dryRun
    });

    await this.audit.record({
      tenantId,
      user,
      action: "pricing.model_training_requested",
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
        })),
        actionPolicy: result.actionPolicy
      }
    });

    for (const policyItem of result.actionPolicy.filter((item) => item.decision === "blocked")) {
      this.realtime.publish(tenantId, "security.event_detected", {
        kind: "blocked-ai-action",
        severity: policyItem.risk === "destructive" ? "critical" : "warning",
        action: "property.ai_assistant",
        userId: user.id,
        userRole: user.role,
        resourceType: "property",
        resourceId: propertyId,
        message: "AI action blocked by policy",
        metadata: {
          blockedAction: policyItem.action,
          risk: policyItem.risk,
          reason: policyItem.reason,
          decision: policyItem.decision
        }
      });
    }

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

  @Post(":propertyId/images/:imageId/delete-preview")
  @Roles("agent", "broker", "manager", "admin")
  async previewImageDelete(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Param("imageId") imageId: string
  ): Promise<PropertyImageDeletePreviewResponse> {
    const preview = await this.propertyImages.createDeletePreview(tenantId, propertyId, imageId, user.id);

    await this.audit.record({
      tenantId,
      user,
      action: "property.image_delete_previewed",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        imageId: preview.image.id,
        imageUrl: preview.image.imageUrl,
        expiresAt: preview.expiresAt
      }
    });

    return preview;
  }

  @Delete(":propertyId/images/:imageId")
  @Roles("agent", "broker", "manager", "admin")
  async removeImage(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Param("imageId") imageId: string,
    @Body() payload: ConfirmPropertyImageDeleteDto
  ): Promise<PropertyImageSnapshot> {
    const image = await this.propertyImages.removeImage(tenantId, propertyId, imageId, payload);

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

  @Post(":propertyId/images/:imageId/restore")
  @Roles("manager", "admin")
  async restoreImage(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Param("imageId") imageId: string
  ): Promise<PropertyImageSnapshot> {
    const image = await this.propertyImages.restoreImage(tenantId, propertyId, imageId);

    const job = await this.jobs.enqueue("properties.search.index", {
      tenantId,
      requestedByUserId: user.id,
      propertyId,
      reason: "updated"
    });

    await this.audit.record({
      tenantId,
      user,
      action: "property.image_restored",
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
      action: "restored",
      imageId: image.id,
      imageUrl: image.imageUrl
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
        engine: result.engine,
        modelVersion: result.modelVersion,
        trainingStatus: result.trainingStatus,
        suggestedPrice: result.suggestedPrice,
        position: result.position,
        confidence: result.confidence,
        comparablePropertyIds: result.comparableProperties.map((property) => property.propertyId)
      }
    });

    return result;
  }

  @Post(":propertyId/price-recommendation/feedback")
  @Roles("agent", "broker", "manager", "admin")
  async submitPriceRecommendationFeedback(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("propertyId") propertyId: string,
    @Body() payload: SubmitPriceRecommendationFeedbackDto
  ): Promise<PropertyPriceRecommendationFeedbackSnapshot> {
    const result = await this.priceRecommendationFeedback.submit(tenantId, propertyId, payload, user);

    await this.audit.record({
      tenantId,
      user,
      action: "property.price_recommendation_feedback",
      resourceType: "property",
      resourceId: propertyId,
      metadata: {
        feedbackId: result.id,
        engine: result.engine,
        modelVersion: result.modelVersion,
        decision: result.decision,
        suggestedPrice: result.suggestedPrice,
        selectedPrice: result.selectedPrice
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

  private buildSavedSearchLeadMessage(savedSearchTitle: string, propertyId?: string): string {
    const propertyContext = propertyId ? ` Selected property: ${propertyId}.` : "";

    return `Lead created from saved search "${savedSearchTitle}".${propertyContext}`;
  }
}
