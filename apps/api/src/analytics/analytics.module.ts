import { Module } from "@nestjs/common";
import { AuthModule } from "../shared/auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { AnalyticsService } from "./application/analytics.service.js";
import { ANALYTICS_REPOSITORY } from "./domain/analytics.repository.js";
import { PgAnalyticsRepository } from "./infrastructure/postgres/pg-analytics.repository.js";
import { AnalyticsController } from "./presentation/rest/analytics.controller.js";

@Module({
  imports: [AuthModule, DatabaseModule, TenantsModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    {
      provide: ANALYTICS_REPOSITORY,
      useClass: PgAnalyticsRepository
    }
  ]
})
export class AnalyticsModule {}

