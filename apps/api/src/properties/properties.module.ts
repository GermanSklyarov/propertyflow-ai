import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { CreatePropertyHandler } from "./application/commands/create-property.handler.js";
import { GetPropertyHandler } from "./application/queries/get-property.handler.js";
import { ListPropertiesHandler } from "./application/queries/list-properties.handler.js";
import { PROPERTY_REPOSITORY } from "./domain/property.repository.js";
import { InMemoryPropertyRepository } from "./infrastructure/in-memory-property.repository.js";
import { PropertiesController } from "./presentation/rest/properties.controller.js";

const commandHandlers = [CreatePropertyHandler];
const queryHandlers = [GetPropertyHandler, ListPropertiesHandler];

@Module({
  imports: [CqrsModule],
  controllers: [PropertiesController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    {
      provide: PROPERTY_REPOSITORY,
      useClass: InMemoryPropertyRepository
    }
  ]
})
export class PropertiesModule {}

