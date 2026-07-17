import type {
  PropertySocialPostPublication,
  RecordPropertySocialPostPublicationRequest,
  RequestUser
} from "@propertyflow/contracts";

export const PROPERTY_SOCIAL_POST_PUBLICATIONS_REPOSITORY = Symbol("PROPERTY_SOCIAL_POST_PUBLICATIONS_REPOSITORY");

export interface PropertySocialPostPublicationsRepository {
  listByPropertyId(tenantId: string, propertyId: string): Promise<PropertySocialPostPublication[]>;
  record(
    tenantId: string,
    propertyId: string,
    request: RecordPropertySocialPostPublicationRequest,
    user: RequestUser
  ): Promise<PropertySocialPostPublication>;
}
