import type {
  PropertySocialPostDraftOverride,
  SavePropertySocialPostDraftRequest,
  RequestUser
} from "@propertyflow/contracts";

export const PROPERTY_SOCIAL_POST_DRAFT_OVERRIDES_REPOSITORY = Symbol("PROPERTY_SOCIAL_POST_DRAFT_OVERRIDES_REPOSITORY");

export interface PropertySocialPostDraftOverridesRepository {
  listByPropertyId(tenantId: string, propertyId: string): Promise<PropertySocialPostDraftOverride[]>;
  save(
    tenantId: string,
    propertyId: string,
    request: SavePropertySocialPostDraftRequest,
    user: RequestUser
  ): Promise<PropertySocialPostDraftOverride>;
}
