import type {
  GeneratedPropertyDescription,
  PropertyAiAssets,
  PropertyImageAnalysisResult,
  ReviewAiAssetRequest,
  UpdateGeneratedPropertyDescriptionRequest,
  UpdatePropertyImageAnalysisRequest
} from "@propertyflow/contracts";
import type { RequestUser } from "@propertyflow/contracts";

export const PROPERTY_AI_ASSETS_REPOSITORY = Symbol("PROPERTY_AI_ASSETS_REPOSITORY");

export interface PropertyAiAssetsRepository {
  getByPropertyId(tenantId: string, propertyId: string): Promise<PropertyAiAssets>;
  findDescriptionById(
    tenantId: string,
    propertyId: string,
    assetId: string
  ): Promise<GeneratedPropertyDescription | null>;
  findImageAnalysisById(
    tenantId: string,
    propertyId: string,
    assetId: string
  ): Promise<PropertyImageAnalysisResult | null>;
  reviewDescription(
    tenantId: string,
    propertyId: string,
    assetId: string,
    request: ReviewAiAssetRequest,
    user: RequestUser
  ): Promise<GeneratedPropertyDescription | null>;
  updateDescription(
    tenantId: string,
    propertyId: string,
    assetId: string,
    request: UpdateGeneratedPropertyDescriptionRequest,
    user: RequestUser
  ): Promise<GeneratedPropertyDescription | null>;
  reviewImageAnalysis(
    tenantId: string,
    propertyId: string,
    assetId: string,
    request: ReviewAiAssetRequest,
    user: RequestUser
  ): Promise<PropertyImageAnalysisResult | null>;
  updateImageAnalysis(
    tenantId: string,
    propertyId: string,
    assetId: string,
    request: UpdatePropertyImageAnalysisRequest,
    user: RequestUser
  ): Promise<PropertyImageAnalysisResult | null>;
}
