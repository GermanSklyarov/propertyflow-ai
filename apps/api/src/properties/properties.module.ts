import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { JobsModule } from "../jobs/jobs.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { SearchObservabilityModule } from "../search-observability/search-observability.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { CreatePropertyHandler } from "./application/commands/create-property.handler.js";
import { GetPropertyHandler } from "./application/queries/get-property.handler.js";
import { ListPropertiesHandler } from "./application/queries/list-properties.handler.js";
import { AiPropertyAdvisorService } from "./application/services/ai-property-advisor.service.js";
import { InvestmentCalculatorService } from "./application/services/investment-calculator.service.js";
import { ListingAssistantService } from "./application/services/listing-assistant.service.js";
import { NaturalLanguagePropertySearchService } from "./application/services/natural-language-property-search.service.js";
import { NeighborhoodIntelligenceService } from "./application/services/neighborhood-intelligence.service.js";
import { PriceHistoryService } from "./application/services/price-history.service.js";
import { PropertyAiAssetsService } from "./application/services/property-ai-assets.service.js";
import { PropertyComparisonService } from "./application/services/property-comparison.service.js";
import { PropertyPublicationService } from "./application/services/property-publication.service.js";
import { IndexedPropertySearchService } from "./application/services/indexed-property-search.service.js";
import { RentalYieldService } from "./application/services/rental-yield.service.js";
import { PROPERTY_AI_ASSETS_REPOSITORY } from "./domain/property-ai-assets.repository.js";
import { PROPERTY_REPOSITORY } from "./domain/property.repository.js";
import { createPropertySearchClient, PROPERTY_SEARCH_CLIENT } from "./infrastructure/opensearch/property-search-client.js";
import { PgPropertyAiAssetsRepository } from "./infrastructure/postgres/pg-property-ai-assets.repository.js";
import { PgPropertyRepository } from "./infrastructure/postgres/pg-property.repository.js";
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
    RealtimeModule,
    SearchObservabilityModule,
    TenantsModule
  ],
  controllers: [PropertiesController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    AiPropertyAdvisorService,
    IndexedPropertySearchService,
    InvestmentCalculatorService,
    ListingAssistantService,
    NaturalLanguagePropertySearchService,
    NeighborhoodIntelligenceService,
    PriceHistoryService,
    PropertyAiAssetsService,
    PropertyComparisonService,
    PropertyPublicationService,
    RentalYieldService,
    {
      provide: PROPERTY_REPOSITORY,
      useClass: PgPropertyRepository
    },
    {
      provide: PROPERTY_AI_ASSETS_REPOSITORY,
      useClass: PgPropertyAiAssetsRepository
    },
    {
      provide: PROPERTY_SEARCH_CLIENT,
      useFactory: createPropertySearchClient
    }
  ]
})
export class PropertiesModule {}
