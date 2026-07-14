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
      listingType: command.payload.listingType ?? "sale",
      amenities: command.payload.amenities ?? [],
      createdAt: now,
      updatedAt: now,
      ...command.payload,
      project: command.payload.project
        ? {
            id: crypto.randomUUID(),
            tenantId: command.tenantId,
            name: command.payload.project.name,
            market: command.payload.market,
            status: command.payload.project.status ?? "completed",
            developer: command.payload.project.developer,
            address: command.payload.project.address,
            completionYear: command.payload.project.completionYear,
            location: command.payload.location,
            amenities: command.payload.project.amenities ?? [],
            createdAt: now,
            updatedAt: now
          }
        : undefined
    };

    const savedProperty = await this.properties.save(property);

    await this.properties.addPriceHistoryPoint(
      savedProperty.tenantId,
      savedProperty.id,
      savedProperty.price,
      "initial-listing",
      savedProperty.createdAt
    );

    return savedProperty;
  }
}
