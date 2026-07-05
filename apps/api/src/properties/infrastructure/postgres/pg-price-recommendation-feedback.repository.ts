import { Inject, Injectable } from "@nestjs/common";
import type {
  PricingTrainingDatasetRow,
  PropertyPriceRecommendationFeedbackDecision,
  PropertyPriceRecommendationFeedbackSnapshot,
  RequestUser,
  SubmitPropertyPriceRecommendationFeedbackRequest,
  UserRole
} from "@propertyflow/contracts";
import type { Currency, PropertyKind, PropertyStatus, ThailandMarket } from "@propertyflow/domain";
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

interface PricingTrainingDatasetRowRecord {
  feedback_id: string;
  property_id: string;
  engine: PropertyPriceRecommendationFeedbackSnapshot["engine"];
  model_version: string;
  decision: PropertyPriceRecommendationFeedbackDecision;
  market: ThailandMarket;
  kind: PropertyKind;
  status: PropertyStatus;
  bedrooms: number;
  bathrooms: number;
  area_sqm: string;
  floor: number | null;
  beach_distance_meters: number | null;
  amenities: string[];
  current_price_amount: string;
  current_price_currency: Currency;
  suggested_price_amount: string;
  suggested_price_currency: Currency;
  selected_price_amount: string | null;
  selected_price_currency: Currency | null;
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

  async listTrainingRows(tenantId: string): Promise<PricingTrainingDatasetRow[]> {
    const result = await this.pool.query<PricingTrainingDatasetRowRecord>(
      `
        select
          feedback.id as feedback_id,
          feedback.property_id,
          feedback.engine,
          feedback.model_version,
          feedback.decision,
          properties.market,
          properties.kind,
          properties.status,
          properties.bedrooms,
          properties.bathrooms,
          properties.area_sqm,
          properties.floor,
          properties.beach_distance_meters,
          properties.amenities,
          properties.price_amount as current_price_amount,
          properties.price_currency as current_price_currency,
          feedback.suggested_price_amount,
          feedback.suggested_price_currency,
          feedback.selected_price_amount,
          feedback.selected_price_currency,
          feedback.created_at
        from property_price_recommendation_feedback feedback
        join properties on properties.tenant_id = feedback.tenant_id and properties.id = feedback.property_id
        where feedback.tenant_id = $1
        order by feedback.created_at desc
      `,
      [tenantId]
    );

    return result.rows.map((row) => this.toTrainingRow(row));
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

  private toTrainingRow(row: PricingTrainingDatasetRowRecord): PricingTrainingDatasetRow {
    const areaSqm = Number(row.area_sqm);
    const currentPrice = {
      amount: Number(row.current_price_amount),
      currency: row.current_price_currency
    };
    const selectedPrice =
      row.selected_price_amount && row.selected_price_currency
        ? {
            amount: Number(row.selected_price_amount),
            currency: row.selected_price_currency
          }
        : undefined;

    return {
      feedbackId: row.feedback_id,
      propertyId: row.property_id,
      engine: row.engine,
      modelVersion: row.model_version,
      decision: row.decision,
      features: {
        market: row.market,
        kind: row.kind,
        status: row.status,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        areaSqm,
        floor: row.floor ?? undefined,
        beachDistanceMeters: row.beach_distance_meters ?? undefined,
        amenities: row.amenities,
        currentPrice,
        currentPricePerSqm: {
          amount: Math.round((currentPrice.amount / areaSqm) * 100) / 100,
          currency: currentPrice.currency
        },
        suggestedPrice: {
          amount: Number(row.suggested_price_amount),
          currency: row.suggested_price_currency
        }
      },
      label: {
        accepted: row.decision === "accepted",
        selectedPrice,
        selectedPricePerSqm: selectedPrice
          ? {
              amount: Math.round((selectedPrice.amount / areaSqm) * 100) / 100,
              currency: selectedPrice.currency
            }
          : undefined
      },
      createdAt: row.created_at.toISOString()
    };
  }
}
