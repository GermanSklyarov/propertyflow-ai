import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { DatabaseModule } from "./database/database.module.js";
import { PropertiesModule } from "./properties/properties.module.js";
import { TenantsModule } from "./tenants/tenants.module.js";

@Module({
  imports: [CqrsModule.forRoot(), DatabaseModule, TenantsModule, PropertiesModule]
})
export class AppModule {}
