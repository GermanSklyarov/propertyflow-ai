import type { PropertyAiAssets } from "@propertyflow/contracts";

export const PROPERTY_AI_ASSETS_REPOSITORY = Symbol("PROPERTY_AI_ASSETS_REPOSITORY");

export interface PropertyAiAssetsRepository {
  getByPropertyId(tenantId: string, propertyId: string): Promise<PropertyAiAssets>;
}
