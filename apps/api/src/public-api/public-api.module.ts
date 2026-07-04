import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { LeadsModule } from "../leads/leads.module.js";
import { PROPERTY_REPOSITORY } from "../properties/domain/property.repository.js";
import { PgPropertyRepository } from "../properties/infrastructure/postgres/pg-property.repository.js";
import { PublicApiKeyService } from "./application/public-api-key.service.js";
import { PUBLIC_API_KEY_REPOSITORY } from "./domain/public-api-key.repository.js";
import { PgPublicApiKeyRepository } from "./infrastructure/postgres/pg-public-api-key.repository.js";
import { PublicApiKeyGuard } from "./presentation/rest/public-api-key.guard.js";
import { PublicLeadsController } from "./presentation/rest/public-leads.controller.js";
import { PublicPropertiesController } from "./presentation/rest/public-properties.controller.js";

@Module({
  imports: [DatabaseModule, LeadsModule],
  controllers: [PublicLeadsController, PublicPropertiesController],
  providers: [
    PublicApiKeyGuard,
    PublicApiKeyService,
    {
      provide: PUBLIC_API_KEY_REPOSITORY,
      useClass: PgPublicApiKeyRepository
    },
    {
      provide: PROPERTY_REPOSITORY,
      useClass: PgPropertyRepository
    }
  ]
})
export class PublicApiModule {}
