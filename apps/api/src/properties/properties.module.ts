import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { JobsModule } from "../jobs/jobs.module.js";
import { LeadsModule } from "../leads/leads.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { SearchObservabilityModule } from "../search-observability/search-observability.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { CreatePropertyHandler } from "./application/commands/create-property.handler.js";
import { GetPropertyHandler } from "./application/queries/get-property.handler.js";
import { ListPropertiesHandler } from "./application/queries/list-properties.handler.js";
import { AmenitySuggestionsService } from "./application/services/amenity-suggestions.service.js";
import { AiPropertyAdvisorService } from "./application/services/ai-property-advisor.service.js";
import { AiAgentActionPolicyService } from "./application/services/ai-agent-action-policy.service.js";
import { InvestmentCalculatorService } from "./application/services/investment-calculator.service.js";
import { ListingAssistantService } from "./application/services/listing-assistant.service.js";
import { NaturalLanguagePropertySearchService } from "./application/services/natural-language-property-search.service.js";
import { NeighborhoodIntelligenceService } from "./application/services/neighborhood-intelligence.service.js";
import { PriceHistoryService } from "./application/services/price-history.service.js";
import { PriceRecommendationFeedbackService } from "./application/services/price-recommendation-feedback.service.js";
import { PriceRecommendationService } from "./application/services/price-recommendation.service.js";
import { PropertyAiAssetsService } from "./application/services/property-ai-assets.service.js";
import { PropertyAmenitiesService } from "./application/services/property-amenities.service.js";
import { PropertyComparisonService } from "./application/services/property-comparison.service.js";
import { PropertyImagesService } from "./application/services/property-images.service.js";
import { PropertyPublicationService } from "./application/services/property-publication.service.js";
import { PropertySocialPostsService } from "./application/services/property-social-posts.service.js";
import { IndexedPropertySearchService } from "./application/services/indexed-property-search.service.js";
import { RentalYieldService } from "./application/services/rental-yield.service.js";
import { SavedSearchLeadCoverageService } from "./application/services/saved-search-lead-coverage.service.js";
import { SavedPropertySearchService } from "./application/services/saved-property-search.service.js";
import { PRICE_RECOMMENDATION_FEEDBACK_REPOSITORY } from "./domain/price-recommendation-feedback.repository.js";
import { PROPERTY_AI_ASSETS_REPOSITORY } from "./domain/property-ai-assets.repository.js";
import { PROPERTY_IMAGES_REPOSITORY } from "./domain/property-images.repository.js";
import { PROPERTY_REPOSITORY } from "./domain/property.repository.js";
import { PROPERTY_SOCIAL_POST_PUBLICATIONS_REPOSITORY } from "./domain/property-social-post-publications.repository.js";
import { PROPERTY_STATUS_HISTORY_REPOSITORY } from "./domain/property-status-history.repository.js";
import { SAVED_SEARCH_ALERT_RUN_REPOSITORY } from "./domain/saved-search-alert-run.repository.js";
import { SAVED_PROPERTY_SEARCH_REPOSITORY } from "./domain/saved-property-search.repository.js";
import { createPropertySearchClient, PROPERTY_SEARCH_CLIENT } from "./infrastructure/opensearch/property-search-client.js";
import { PgPropertyAiAssetsRepository } from "./infrastructure/postgres/pg-property-ai-assets.repository.js";
import { PgPropertyImagesRepository } from "./infrastructure/postgres/pg-property-images.repository.js";
import { PgPropertyRepository } from "./infrastructure/postgres/pg-property.repository.js";
import { PgPropertySocialPostPublicationsRepository } from "./infrastructure/postgres/pg-property-social-post-publications.repository.js";
import { PgPropertyStatusHistoryRepository } from "./infrastructure/postgres/pg-property-status-history.repository.js";
import { PgPriceRecommendationFeedbackRepository } from "./infrastructure/postgres/pg-price-recommendation-feedback.repository.js";
import { PgSavedSearchAlertRunRepository } from "./infrastructure/postgres/pg-saved-search-alert-run.repository.js";
import { PgSavedPropertySearchRepository } from "./infrastructure/postgres/pg-saved-property-search.repository.js";
import { PropertiesController } from "./presentation/rest/properties.controller.js";

const commandHandlers = [CreatePropertyHandler];
const queryHandlers = [GetPropertyHandler, ListPropertiesHandler];

@Module({
  imports: [
    AuditModule,
    AuthModule,
    CqrsModule,
    DatabaseModule,
    JobsModule,
    LeadsModule,
    RealtimeModule,
    SearchObservabilityModule,
    StorageModule,
    TenantsModule
  ],
  controllers: [PropertiesController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    AmenitySuggestionsService,
    AiAgentActionPolicyService,
    AiPropertyAdvisorService,
    IndexedPropertySearchService,
    InvestmentCalculatorService,
    ListingAssistantService,
    NaturalLanguagePropertySearchService,
    NeighborhoodIntelligenceService,
    PriceHistoryService,
    PriceRecommendationFeedbackService,
    PriceRecommendationService,
    PropertyAiAssetsService,
    PropertyAmenitiesService,
    PropertyComparisonService,
    PropertyImagesService,
    PropertyPublicationService,
    PropertySocialPostsService,
    RentalYieldService,
    SavedSearchLeadCoverageService,
    SavedPropertySearchService,
    {
      provide: PROPERTY_REPOSITORY,
      useClass: PgPropertyRepository
    },
    {
      provide: PROPERTY_AI_ASSETS_REPOSITORY,
      useClass: PgPropertyAiAssetsRepository
    },
    {
      provide: PROPERTY_IMAGES_REPOSITORY,
      useClass: PgPropertyImagesRepository
    },
    {
      provide: PROPERTY_STATUS_HISTORY_REPOSITORY,
      useClass: PgPropertyStatusHistoryRepository
    },
    {
      provide: PROPERTY_SOCIAL_POST_PUBLICATIONS_REPOSITORY,
      useClass: PgPropertySocialPostPublicationsRepository
    },
    {
      provide: PROPERTY_SEARCH_CLIENT,
      useFactory: createPropertySearchClient
    },
    {
      provide: PRICE_RECOMMENDATION_FEEDBACK_REPOSITORY,
      useClass: PgPriceRecommendationFeedbackRepository
    },
    {
      provide: SAVED_PROPERTY_SEARCH_REPOSITORY,
      useClass: PgSavedPropertySearchRepository
    },
    {
      provide: SAVED_SEARCH_ALERT_RUN_REPOSITORY,
      useClass: PgSavedSearchAlertRunRepository
    }
  ],
  exports: [
    AiPropertyAdvisorService,
    NaturalLanguagePropertySearchService,
    NeighborhoodIntelligenceService,
    PriceRecommendationService,
    PROPERTY_REPOSITORY
  ]
})
export class PropertiesModule {}
