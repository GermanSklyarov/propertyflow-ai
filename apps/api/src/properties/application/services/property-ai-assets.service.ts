import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PropertyAiAssets } from "@propertyflow/contracts";
import {
  PROPERTY_AI_ASSETS_REPOSITORY,
  type PropertyAiAssetsRepository
} from "../../domain/property-ai-assets.repository.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

@Injectable()
export class PropertyAiAssetsService {
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(PROPERTY_AI_ASSETS_REPOSITORY) private readonly aiAssets: PropertyAiAssetsRepository
  ) {}

  async getByPropertyId(tenantId: string, propertyId: string): Promise<PropertyAiAssets> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    return this.aiAssets.getByPropertyId(tenantId, propertyId);
  }
}
