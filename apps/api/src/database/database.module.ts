import { Module } from "@nestjs/common";
import { Pool } from "pg";
import { loadAppConfig } from "@propertyflow/config";
import { PG_POOL } from "./database.constants.js";
import { HealthController } from "./health.controller.js";

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => {
        const config = loadAppConfig();

        return new Pool({
          connectionString: config.databaseUrl,
          max: 10
        });
      }
    }
  ],
  exports: [PG_POOL]
})
export class DatabaseModule {}

