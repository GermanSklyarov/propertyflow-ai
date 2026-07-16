import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  GeneratedPropertyDescription,
  PropertyAiAssets,
  PropertyImageAnalysisResult,
  RequestUser,
  ReviewAiAssetRequest,
  UpdateGeneratedPropertyDescriptionRequest,
  UpdatePropertyImageAnalysisRequest
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import {
  PROPERTY_AI_ASSETS_REPOSITORY,
  type PropertyAiAssetsRepository
} from "../../domain/property-ai-assets.repository.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";
import { normalizeAmenities } from "./property-amenities.service.js";

export interface ApplyImageAnalysisResult {
  property: PropertySnapshot;
  addedAmenities: string[];
}

@Injectable()
export class PropertyAiAssetsService {
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(PROPERTY_AI_ASSETS_REPOSITORY) private readonly aiAssets: PropertyAiAssetsRepository
  ) {}

  async getByPropertyId(tenantId: string, propertyId: string): Promise<PropertyAiAssets> {
    await this.ensurePropertyExists(tenantId, propertyId);

    return this.aiAssets.getByPropertyId(tenantId, propertyId);
  }

  async reviewDescription(
    tenantId: string,
    propertyId: string,
    assetId: string,
    request: ReviewAiAssetRequest,
    user: RequestUser
  ): Promise<GeneratedPropertyDescription> {
    await this.ensurePropertyExists(tenantId, propertyId);

    const result = await this.aiAssets.reviewDescription(tenantId, propertyId, assetId, request, user);

    if (!result) {
      throw new NotFoundException("AI description asset not found");
    }

    return result;
  }

  async reviewImageAnalysis(
    tenantId: string,
    propertyId: string,
    assetId: string,
    request: ReviewAiAssetRequest,
    user: RequestUser
  ): Promise<PropertyImageAnalysisResult> {
    await this.ensurePropertyExists(tenantId, propertyId);

    const result = await this.aiAssets.reviewImageAnalysis(tenantId, propertyId, assetId, request, user);

    if (!result) {
      throw new NotFoundException("AI image analysis asset not found");
    }

    return result;
  }

  async updateDescription(
    tenantId: string,
    propertyId: string,
    assetId: string,
    request: UpdateGeneratedPropertyDescriptionRequest,
    user: RequestUser
  ): Promise<GeneratedPropertyDescription> {
    await this.ensurePropertyExists(tenantId, propertyId);

    const title = request.title.trim();
    const description = request.description.trim();

    if (!title || !description) {
      throw new BadRequestException("AI description title and description are required");
    }

    const result = await this.aiAssets.updateDescription(
      tenantId,
      propertyId,
      assetId,
      {
        ...request,
        description,
        title
      },
      user
    );

    if (!result) {
      throw new NotFoundException("AI description asset not found");
    }

    return result;
  }

  async updateImageAnalysis(
    tenantId: string,
    propertyId: string,
    assetId: string,
    request: UpdatePropertyImageAnalysisRequest,
    user: RequestUser
  ): Promise<PropertyImageAnalysisResult> {
    await this.ensurePropertyExists(tenantId, propertyId);

    const currentAsset = await this.aiAssets.findImageAnalysisById(tenantId, propertyId, assetId);

    if (!currentAsset) {
      throw new NotFoundException("AI image analysis asset not found");
    }

    const detectedFeatures = normalizeAmenities(request.detectedFeatures);

    if (!detectedFeatures.length) {
      throw new BadRequestException("At least one detected feature is required");
    }

    const result = await this.aiAssets.updateImageAnalysis(
      tenantId,
      propertyId,
      assetId,
      {
        ...request,
        confidence: request.confidence ?? currentAsset.confidence,
        detectedFeatures
      },
      user
    );

    if (!result) {
      throw new NotFoundException("AI image analysis asset not found");
    }

    return result;
  }

  async applyApprovedDescription(tenantId: string, propertyId: string, assetId: string): Promise<PropertySnapshot> {
    await this.ensurePropertyExists(tenantId, propertyId);

    const asset = await this.aiAssets.findDescriptionById(tenantId, propertyId, assetId);

    if (!asset) {
      throw new NotFoundException("AI description asset not found");
    }

    if (asset.reviewStatus !== "approved") {
      throw new BadRequestException("AI description asset must be approved before applying");
    }

    const property = await this.properties.updateListingText(tenantId, propertyId, asset.title, asset.description);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    return property;
  }

  async applyApprovedImageAnalysis(
    tenantId: string,
    propertyId: string,
    assetId: string
  ): Promise<ApplyImageAnalysisResult> {
    const currentProperty = await this.properties.findById(tenantId, propertyId);

    if (!currentProperty) {
      throw new NotFoundException("Property not found");
    }

    const asset = await this.aiAssets.findImageAnalysisById(tenantId, propertyId, assetId);

    if (!asset) {
      throw new NotFoundException("AI image analysis asset not found");
    }

    if (asset.reviewStatus !== "approved") {
      throw new BadRequestException("AI image analysis asset must be approved before applying");
    }

    const existingAmenities = new Set(currentProperty.amenities);
    const addedAmenities = asset.detectedFeatures.filter((feature) => {
      if (existingAmenities.has(feature)) {
        return false;
      }

      existingAmenities.add(feature);
      return true;
    });

    if (!addedAmenities.length) {
      return {
        property: currentProperty,
        addedAmenities
      };
    }

    const property = await this.properties.updateAmenities(tenantId, propertyId, [
      ...currentProperty.amenities,
      ...addedAmenities
    ]);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    return {
      property,
      addedAmenities
    };
  }

  private async ensurePropertyExists(tenantId: string, propertyId: string): Promise<void> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }
  }
}
