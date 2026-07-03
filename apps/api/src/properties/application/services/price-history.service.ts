import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PropertyPriceHistory, PropertyPriceHistoryPoint } from "@propertyflow/contracts";
import type { Money } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

@Injectable()
export class PriceHistoryService {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  async getHistory(tenantId: string, propertyId: string): Promise<PropertyPriceHistory> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const storedPoints = await this.properties.listPriceHistory(tenantId, propertyId);
    const points = storedPoints.length
      ? storedPoints
      : [
          {
            effectiveDate: property.updatedAt,
            price: property.price,
            source: "fallback-current-price" as const
          }
        ];
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const changeAmount = points.length > 1 ? this.subtractMoney(lastPoint.price, firstPoint.price) : undefined;
    const changePercent =
      changeAmount && firstPoint.price.amount > 0
        ? Math.round((changeAmount.amount / firstPoint.price.amount) * 10_000) / 100
        : undefined;

    return {
      propertyId,
      currentPrice: property.price,
      points,
      changeAmount,
      changePercent,
      trend: this.detectTrend(changePercent),
      summary: this.buildSummary(points, changePercent)
    };
  }

  private subtractMoney(current: Money, previous: Money): Money {
    return {
      amount: Math.round((current.amount - previous.amount) * 100) / 100,
      currency: current.currency
    };
  }

  private detectTrend(changePercent: number | undefined): PropertyPriceHistory["trend"] {
    if (changePercent === undefined) {
      return "insufficient-data";
    }

    if (changePercent > 1) {
      return "up";
    }

    if (changePercent < -1) {
      return "down";
    }

    return "flat";
  }

  private buildSummary(points: PropertyPriceHistoryPoint[], changePercent: number | undefined): string {
    if (points.length < 2 || changePercent === undefined) {
      return "Only current price is available, so trend is not established yet.";
    }

    if (changePercent > 1) {
      return `Price increased by ${changePercent.toFixed(1)}% across ${points.length} recorded points.`;
    }

    if (changePercent < -1) {
      return `Price decreased by ${Math.abs(changePercent).toFixed(1)}% across ${points.length} recorded points.`;
    }

    return `Price stayed broadly flat across ${points.length} recorded points.`;
  }
}

