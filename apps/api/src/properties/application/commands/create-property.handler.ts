import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { PropertySnapshot } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";
import { CreatePropertyCommand } from "./create-property.command.js";

@CommandHandler(CreatePropertyCommand)
export class CreatePropertyHandler implements ICommandHandler<CreatePropertyCommand, PropertySnapshot> {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  async execute(command: CreatePropertyCommand): Promise<PropertySnapshot> {
    const now = new Date().toISOString();
    const property: PropertySnapshot = {
      id: crypto.randomUUID(),
      tenantId: command.tenantId,
      status: "draft",
      amenities: command.payload.amenities ?? [],
      createdAt: now,
      updatedAt: now,
      ...command.payload
    };

    return this.properties.save(property);
  }
}

