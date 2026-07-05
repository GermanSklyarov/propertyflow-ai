import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PropertyStatusHistoryResponse, RequestUser } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";
import {
  PROPERTY_STATUS_HISTORY_REPOSITORY,
  type PropertyStatusHistoryRepository
} from "../../domain/property-status-history.repository.js";

export interface PublishedPropertyResult {
  property: PropertySnapshot;
  previousStatus: PropertySnapshot["status"];
  changed: boolean;
}

export interface PropertyStatusChangeResult {
  property: PropertySnapshot;
  previousStatus: PropertySnapshot["status"];
  changed: boolean;
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
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(PROPERTY_STATUS_HISTORY_REPOSITORY)
    private readonly statusHistory: PropertyStatusHistoryRepository
  ) {}

  async publish(tenantId: string, propertyId: string, user: RequestUser): Promise<PublishedPropertyResult> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    if (property.status === "available") {
      return {
        property,
        previousStatus: property.status,
        changed: false
      };
    }

    if (property.status !== "draft") {
      throw new ConflictException(`Property with status "${property.status}" cannot be published`);
    }

    const published = await this.properties.updateStatus(tenantId, propertyId, "available");

    if (!published) {
      throw new NotFoundException("Property not found");
    }

    await this.statusHistory.record({
      tenantId,
      propertyId,
      previousStatus: property.status,
      status: published.status,
      user
    });

    return {
      property: published,
      previousStatus: property.status,
      changed: true
    };
  }

  async changeStatus(
    tenantId: string,
    propertyId: string,
    status: PropertySnapshot["status"],
    user: RequestUser,
    note?: string
  ): Promise<PropertyStatusChangeResult> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    if (property.status === status) {
      return {
        property,
        previousStatus: property.status,
        changed: false
      };
    }

    if (!allowedStatusTransitions[property.status].includes(status)) {
      throw new ConflictException(`Property status cannot change from "${property.status}" to "${status}"`);
    }

    const updated = await this.properties.updateStatus(tenantId, propertyId, status);

    if (!updated) {
      throw new NotFoundException("Property not found");
    }

    await this.statusHistory.record({
      tenantId,
      propertyId,
      previousStatus: property.status,
      status: updated.status,
      user,
      note
    });

    return {
      property: updated,
      previousStatus: property.status,
      changed: true
    };
  }

  async getStatusHistory(tenantId: string, propertyId: string): Promise<PropertyStatusHistoryResponse> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    return {
      propertyId,
      items: await this.statusHistory.listByPropertyId(tenantId, propertyId)
    };
  }
}
