import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { UpdatePropertyAmenitiesRequest } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { normalizeAmenityLabel } from "../../domain/amenity-suggestions.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

@Injectable()
export class PropertyAmenitiesService {
  constructor(
    @Inject(PROPERTY_REPOSITORY)
    private readonly properties: PropertyRepository
  ) {}

  async update(tenantId: string, propertyId: string, request: UpdatePropertyAmenitiesRequest): Promise<PropertySnapshot> {
    const property = await this.properties.updateAmenities(tenantId, propertyId, normalizeAmenities(request.amenities));

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    return property;
  }
}

export function normalizeAmenities(amenities: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const amenity of amenities) {
    const label = amenity.trim();
    const normalized = normalizeAmenityLabel(label);

    if (!label || !normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(label);
  }

  return result;
}
