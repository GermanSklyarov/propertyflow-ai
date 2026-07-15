import { Inject, Injectable } from "@nestjs/common";
import type { AmenitySuggestionRequest, AmenitySuggestionResponse } from "@propertyflow/contracts";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

@Injectable()
export class AmenitySuggestionsService {
  constructor(
    @Inject(PROPERTY_REPOSITORY)
    private readonly properties: PropertyRepository
  ) {}

  search(tenantId: string, filters: AmenitySuggestionRequest): Promise<AmenitySuggestionResponse> {
    return this.properties.searchAmenities(tenantId, filters);
  }
}
