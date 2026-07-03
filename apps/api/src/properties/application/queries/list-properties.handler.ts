import { Inject } from "@nestjs/common";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { PropertySearchResponse } from "@propertyflow/contracts";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";
import { ListPropertiesQuery } from "./list-properties.query.js";

@QueryHandler(ListPropertiesQuery)
export class ListPropertiesHandler implements IQueryHandler<ListPropertiesQuery, PropertySearchResponse> {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  async execute(query: ListPropertiesQuery): Promise<PropertySearchResponse> {
    const items = await this.properties.search(query.tenantId, query.filters);

    return {
      items,
      total: items.length,
      filters: query.filters
    };
  }
}
