import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { DatabaseModule } from "./database/database.module.js";
import { PropertiesModule } from "./properties/properties.module.js";

@Module({
  imports: [CqrsModule.forRoot(), DatabaseModule, PropertiesModule]
})
export class AppModule {}
