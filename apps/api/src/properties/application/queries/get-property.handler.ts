import { Inject, NotFoundException } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { PropertySnapshot } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";
import { GetPropertyQuery } from "./get-property.query.js";

@QueryHandler(GetPropertyQuery)
export class GetPropertyHandler implements IQueryHandler<GetPropertyQuery, PropertySnapshot> {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  async execute(query: GetPropertyQuery): Promise<PropertySnapshot> {
    const property = await this.properties.findById(query.tenantId, query.propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    return property;
  }
}

