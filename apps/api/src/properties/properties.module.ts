import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { CreatePropertyHandler } from "./application/commands/create-property.handler.js";
import { GetPropertyHandler } from "./application/queries/get-property.handler.js";
import { ListPropertiesHandler } from "./application/queries/list-properties.handler.js";
import { AiPropertyAdvisorService } from "./application/services/ai-property-advisor.service.js";
import { InvestmentCalculatorService } from "./application/services/investment-calculator.service.js";
import { NaturalLanguagePropertySearchService } from "./application/services/natural-language-property-search.service.js";
import { NeighborhoodIntelligenceService } from "./application/services/neighborhood-intelligence.service.js";
import { PriceHistoryService } from "./application/services/price-history.service.js";
import { PropertyComparisonService } from "./application/services/property-comparison.service.js";
import { RentalYieldService } from "./application/services/rental-yield.service.js";
import { PROPERTY_REPOSITORY } from "./domain/property.repository.js";
import { PgPropertyRepository } from "./infrastructure/postgres/pg-property.repository.js";
import { PropertiesController } from "./presentation/rest/properties.controller.js";

const commandHandlers = [CreatePropertyHandler];
const queryHandlers = [GetPropertyHandler, ListPropertiesHandler];

@Module({
  imports: [AuditModule, AuthModule, CqrsModule, DatabaseModule, TenantsModule],
  controllers: [PropertiesController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    AiPropertyAdvisorService,
    InvestmentCalculatorService,
    NaturalLanguagePropertySearchService,
    NeighborhoodIntelligenceService,
    PriceHistoryService,
    PropertyComparisonService,
    RentalYieldService,
    {
      provide: PROPERTY_REPOSITORY,
      useClass: PgPropertyRepository
    }
  ]
})
export class PropertiesModule {}
