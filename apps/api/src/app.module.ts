import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { PropertiesModule } from "./properties/properties.module.js";

@Module({
  imports: [CqrsModule.forRoot(), PropertiesModule]
})
export class AppModule {}

