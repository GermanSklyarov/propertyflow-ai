import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ComparePropertiesRequest,
  PropertyComparisonResponse,
  PropertyComparisonScore,
  PropertyComparisonWinner
} from "@propertyflow/contracts";
import type { PropertyPurpose, PropertySnapshot } from "@propertyflow/domain";
import { calculateGrossYield } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

const PURPOSES: PropertyPurpose[] = ["investment", "living", "family", "relocation"];

@Injectable()
export class PropertyComparisonService {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  async compare(tenantId: string, request: ComparePropertiesRequest): Promise<PropertyComparisonResponse> {
    const propertyIds = [...new Set(request.propertyIds)];

    if (propertyIds.length < 2 || propertyIds.length > 3) {
      throw new BadRequestException("Compare requires 2 or 3 unique propertyIds");
    }

    const properties = await Promise.all(propertyIds.map((propertyId) => this.properties.findById(tenantId, propertyId)));

    if (properties.some((property) => !property)) {
      throw new NotFoundException("One or more properties were not found");
    }

    const snapshots = properties as PropertySnapshot[];
    const scores = PURPOSES.flatMap((purpose) => snapshots.map((property) => this.scoreProperty(property, purpose)));
    const winners = PURPOSES.map((purpose) => this.pickWinner(purpose, scores));

    return {
      comparedPropertyIds: propertyIds,
      scores,
      winners,
      summary: this.buildSummary(winners)
    };
  }

  private scoreProperty(property: PropertySnapshot, purpose: PropertyPurpose): PropertyComparisonScore {
    const reasons: string[] = [];
    let score = 0;

    if (purpose === "investment") {
      const grossYield = this.grossYield(property);

      if (grossYield !== undefined) {
        score += grossYield * 100;
        reasons.push(`Estimated gross yield ${(grossYield * 100).toFixed(1)}%.`);
      }

      if (property.monthlyRentEstimate) {
        score += 2;
        reasons.push("Has rent estimate for investment analysis.");
      }

      if ((property.beachDistanceMeters ?? Number.POSITIVE_INFINITY) <= 1000) {
        score += 2;
        reasons.push("Close beach access can support rental demand.");
      }

      if (property.amenities.includes("sea-view")) {
        score += 1.5;
        reasons.push("Sea view improves rental positioning.");
      }
    }

    if (purpose === "living") {
      score += Math.min(property.areaSqm / 20, 4);
      reasons.push(`Comfort score from ${property.areaSqm} sqm.`);

      if ((property.beachDistanceMeters ?? Number.POSITIVE_INFINITY) <= 1000) {
        score += 3;
        reasons.push("Beach is within a practical daily distance.");
      }

      if (property.amenities.includes("fast-internet")) {
        score += 2;
        reasons.push("Fast internet supports remote work and winter stays.");
      }

      if (property.amenities.includes("pool")) {
        score += 1;
        reasons.push("Pool improves everyday lifestyle value.");
      }
    }

    if (purpose === "family") {
      score += property.bedrooms * 2;
      reasons.push(`${property.bedrooms} bedroom signal.`);

      score += Math.min(property.areaSqm / 25, 4);
      reasons.push(`Family comfort from ${property.areaSqm} sqm.`);

      if (property.bathrooms >= 2) {
        score += 2;
        reasons.push("Two or more bathrooms is better for family use.");
      }

      if (property.floor !== undefined && property.floor <= 10) {
        score += 1;
        reasons.push("Moderate floor can be more convenient for family living.");
      }
    }

    if (purpose === "relocation") {
      if (property.amenities.includes("fast-internet")) {
        score += 3;
        reasons.push("Fast internet supports relocation and remote work.");
      }

      if (property.amenities.includes("gym")) {
        score += 1;
        reasons.push("Gym amenity helps with long-stay convenience.");
      }

      if ((property.beachDistanceMeters ?? Number.POSITIVE_INFINITY) <= 1500) {
        score += 2;
        reasons.push("Beach access improves relocation lifestyle.");
      }

      score += Math.min(property.areaSqm / 25, 3);
      reasons.push(`Long-stay comfort from ${property.areaSqm} sqm.`);
    }

    return {
      propertyId: property.id,
      title: property.title,
      purpose,
      score: Math.round(score * 10) / 10,
      reasons: reasons.length ? reasons : ["Not enough strong signals for this purpose."]
    };
  }

  private pickWinner(purpose: PropertyPurpose, scores: PropertyComparisonScore[]): PropertyComparisonWinner {
    const purposeScores = scores
      .filter((score) => score.purpose === purpose)
      .sort((left, right) => right.score - left.score);
    const winner = purposeScores[0];

    return {
      purpose,
      propertyId: winner.propertyId,
      title: winner.title,
      score: winner.score,
      explanation: winner.reasons[0] ?? "Highest overall score for this purpose."
    };
  }

  private buildSummary(winners: PropertyComparisonWinner[]): string {
    return winners
      .map((winner) => `${winner.title} leads for ${winner.purpose} with score ${winner.score}.`)
      .join(" ");
  }

  private grossYield(property: PropertySnapshot): number | undefined {
    if (!property.monthlyRentEstimate) {
      return undefined;
    }

    return calculateGrossYield({
      propertyId: property.id,
      purchasePrice: property.price,
      monthlyRent: property.monthlyRentEstimate,
      occupancyRate: 0.85,
      annualCosts: {
        amount: 0,
        currency: property.price.currency
      }
    });
  }
}

