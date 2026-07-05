import { Inject, Injectable } from "@nestjs/common";
import type {
  PropertyPriceRecommendationFeedbackDecision,
  PropertyPriceRecommendationFeedbackSnapshot,
  RequestUser,
  SubmitPropertyPriceRecommendationFeedbackRequest,
  UserRole
} from "@propertyflow/contracts";
import type { Currency } from "@propertyflow/domain";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { PriceRecommendationFeedbackRepository } from "../../domain/price-recommendation-feedback.repository.js";

interface PriceRecommendationFeedbackRow {
  id: string;
  tenant_id: string;
  property_id: string;
  engine: PropertyPriceRecommendationFeedbackSnapshot["engine"];
  model_version: string;
  recommendation_generated_at: Date | null;
  suggested_price_amount: string;
  suggested_price_currency: Currency;
  decision: PropertyPriceRecommendationFeedbackDecision;
  selected_price_amount: string | null;
  selected_price_currency: Currency | null;
  note: string | null;
  created_by_user_id: string | null;
  created_by_user_role: UserRole | null;
  created_at: Date;
}

@Injectable()
export class PgPriceRecommendationFeedbackRepository implements PriceRecommendationFeedbackRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async save(
    tenantId: string,
    propertyId: string,
    request: SubmitPropertyPriceRecommendationFeedbackRequest,
    user: RequestUser
  ): Promise<PropertyPriceRecommendationFeedbackSnapshot> {
    const result = await this.pool.query<PriceRecommendationFeedbackRow>(
      `
        insert into property_price_recommendation_feedback (
          id,
          tenant_id,
          property_id,
          engine,
          model_version,
          recommendation_generated_at,
          suggested_price_amount,
          suggested_price_currency,
          decision,
          selected_price_amount,
          selected_price_currency,
          note,
          created_by_user_id,
          created_by_user_role,
          created_at
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15
        )
        returning *
      `,
      [
        crypto.randomUUID(),
        tenantId,
        propertyId,
        request.engine,
        request.modelVersion,
        request.recommendationGeneratedAt ?? null,
        request.suggestedPrice.amount,
        request.suggestedPrice.currency,
        request.decision,
        request.selectedPrice?.amount ?? null,
        request.selectedPrice?.currency ?? null,
        request.note ?? null,
        user.id,
        user.role,
        new Date().toISOString()
      ]
    );

    return this.toSnapshot(result.rows[0]);
  }

  private toSnapshot(row: PriceRecommendationFeedbackRow): PropertyPriceRecommendationFeedbackSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      engine: row.engine,
      modelVersion: row.model_version,
      recommendationGeneratedAt: row.recommendation_generated_at?.toISOString(),
      suggestedPrice: {
        amount: Number(row.suggested_price_amount),
        currency: row.suggested_price_currency
      },
      decision: row.decision,
      selectedPrice:
        row.selected_price_amount && row.selected_price_currency
          ? {
              amount: Number(row.selected_price_amount),
              currency: row.selected_price_currency
            }
          : undefined,
      note: row.note ?? undefined,
      createdByUserId: row.created_by_user_id ?? undefined,
      createdByUserRole: row.created_by_user_role ?? undefined,
      createdAt: row.created_at.toISOString()
    };
  }
}
