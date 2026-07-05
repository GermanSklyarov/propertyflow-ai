import type {
  PropertyPriceRecommendationFeedbackSnapshot,
  RequestUser,
  SubmitPropertyPriceRecommendationFeedbackRequest
} from "@propertyflow/contracts";

export const PRICE_RECOMMENDATION_FEEDBACK_REPOSITORY = Symbol("PRICE_RECOMMENDATION_FEEDBACK_REPOSITORY");

export interface PriceRecommendationFeedbackRepository {
  save(
    tenantId: string,
    propertyId: string,
    request: SubmitPropertyPriceRecommendationFeedbackRequest,
    user: RequestUser
  ): Promise<PropertyPriceRecommendationFeedbackSnapshot>;
}
