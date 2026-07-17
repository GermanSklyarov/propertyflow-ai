import type {
  PropertySocialPostReview,
  RecordPropertySocialPostReviewRequest,
  RequestUser
} from "@propertyflow/contracts";

export const PROPERTY_SOCIAL_POST_REVIEWS_REPOSITORY = Symbol("PROPERTY_SOCIAL_POST_REVIEWS_REPOSITORY");

export interface PropertySocialPostReviewsRepository {
  listByPropertyId(tenantId: string, propertyId: string): Promise<PropertySocialPostReview[]>;
  record(
    tenantId: string,
    propertyId: string,
    request: RecordPropertySocialPostReviewRequest,
    user: RequestUser
  ): Promise<PropertySocialPostReview>;
}
