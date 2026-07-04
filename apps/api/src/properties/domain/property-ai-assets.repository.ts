import type { GeneratedPropertyDescription, PropertyAiAssets, PropertyImageAnalysisResult, ReviewAiAssetRequest } from "@propertyflow/contracts";
import type { RequestUser } from "@propertyflow/contracts";

export const PROPERTY_AI_ASSETS_REPOSITORY = Symbol("PROPERTY_AI_ASSETS_REPOSITORY");

export interface PropertyAiAssetsRepository {
  getByPropertyId(tenantId: string, propertyId: string): Promise<PropertyAiAssets>;
  reviewDescription(
    tenantId: string,
    propertyId: string,
    assetId: string,
    request: ReviewAiAssetRequest,
    user: RequestUser
  ): Promise<GeneratedPropertyDescription | null>;
  reviewImageAnalysis(
    tenantId: string,
    propertyId: string,
    assetId: string,
    request: ReviewAiAssetRequest,
    user: RequestUser
  ): Promise<PropertyImageAnalysisResult | null>;
}
