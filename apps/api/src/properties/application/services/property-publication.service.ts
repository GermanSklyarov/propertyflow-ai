import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PropertySnapshot } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

export interface PublishedPropertyResult {
  property: PropertySnapshot;
  previousStatus: PropertySnapshot["status"];
}

export interface PropertyStatusChangeResult {
  property: PropertySnapshot;
  previousStatus: PropertySnapshot["status"];
}

const allowedStatusTransitions: Record<PropertySnapshot["status"], PropertySnapshot["status"][]> = {
  draft: ["available", "archived"],
  available: ["reserved", "sold", "archived"],
  reserved: ["available", "sold", "archived"],
  sold: ["archived"],
  archived: ["draft"]
};

@Injectable()
export class PropertyPublicationService {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  async publish(tenantId: string, propertyId: string): Promise<PublishedPropertyResult> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    if (property.status === "available") {
      return {
        property,
        previousStatus: property.status
      };
    }

    if (property.status !== "draft") {
      throw new ConflictException(`Property with status "${property.status}" cannot be published`);
    }

    const published = await this.properties.updateStatus(tenantId, propertyId, "available");

    if (!published) {
      throw new NotFoundException("Property not found");
    }

    return {
      property: published,
      previousStatus: property.status
    };
  }

  async changeStatus(
    tenantId: string,
    propertyId: string,
    status: PropertySnapshot["status"]
  ): Promise<PropertyStatusChangeResult> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    if (property.status === status) {
      return {
        property,
        previousStatus: property.status
      };
    }

    if (!allowedStatusTransitions[property.status].includes(status)) {
      throw new ConflictException(`Property status cannot change from "${property.status}" to "${status}"`);
    }

    const updated = await this.properties.updateStatus(tenantId, propertyId, status);

    if (!updated) {
      throw new NotFoundException("Property not found");
    }

    return {
      property: updated,
      previousStatus: property.status
    };
  }
}
