import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  PricingTrainingDatasetResponse,
  PropertyPriceRecommendationFeedbackSnapshot,
  RequestUser,
  SubmitPropertyPriceRecommendationFeedbackRequest
} from "@propertyflow/contracts";
import {
  PRICE_RECOMMENDATION_FEEDBACK_REPOSITORY,
  type PriceRecommendationFeedbackRepository
} from "../../domain/price-recommendation-feedback.repository.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

@Injectable()
export class PriceRecommendationFeedbackService {
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(PRICE_RECOMMENDATION_FEEDBACK_REPOSITORY)
    private readonly feedback: PriceRecommendationFeedbackRepository
  ) {}

  async submit(
    tenantId: string,
    propertyId: string,
    request: SubmitPropertyPriceRecommendationFeedbackRequest,
    user: RequestUser
  ): Promise<PropertyPriceRecommendationFeedbackSnapshot> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    if (request.decision === "adjusted" && !request.selectedPrice) {
      throw new BadRequestException("selectedPrice is required when decision is adjusted");
    }

    if (request.selectedPrice && request.selectedPrice.currency !== request.suggestedPrice.currency) {
      throw new BadRequestException("selectedPrice currency must match suggestedPrice currency");
    }

    return this.feedback.save(tenantId, propertyId, request, user);
  }

  async trainingDataset(tenantId: string): Promise<PricingTrainingDatasetResponse> {
    const items = await this.feedback.listTrainingRows(tenantId);

    return {
      items,
      total: items.length,
      generatedAt: new Date().toISOString()
    };
  }
}
