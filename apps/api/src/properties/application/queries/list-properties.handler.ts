import { Inject } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { PropertyListResponse } from "@propertyflow/contracts";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";
import { ListPropertiesQuery } from "./list-properties.query.js";

@QueryHandler(ListPropertiesQuery)
export class ListPropertiesHandler implements IQueryHandler<ListPropertiesQuery, PropertyListResponse> {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  async execute(query: ListPropertiesQuery): Promise<PropertyListResponse> {
    return {
      items: await this.properties.list(query.tenantId)
    };
  }
}

