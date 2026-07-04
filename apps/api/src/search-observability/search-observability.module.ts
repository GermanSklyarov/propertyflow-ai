import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { SearchObservabilityService } from "./application/search-observability.service.js";
import { SEARCH_EVENT_REPOSITORY } from "./domain/search-event.repository.js";
import { PgSearchEventRepository } from "./infrastructure/postgres/pg-search-event.repository.js";

@Module({
  imports: [DatabaseModule],
  providers: [
    SearchObservabilityService,
    {
      provide: SEARCH_EVENT_REPOSITORY,
      useClass: PgSearchEventRepository
    }
  ],
  exports: [SearchObservabilityService]
})
export class SearchObservabilityModule {}
