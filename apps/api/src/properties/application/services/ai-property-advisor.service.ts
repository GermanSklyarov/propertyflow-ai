import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AiAdvisorSummary } from "@propertyflow/contracts";
import type { PropertyPurpose, PropertySnapshot } from "@propertyflow/domain";
import { calculateGrossYield, calculateNetYield } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

@Injectable()
export class AiPropertyAdvisorService {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  async summarize(tenantId: string, propertyId: string): Promise<AiAdvisorSummary> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const grossYield = this.calculateGrossYield(property);
    const netYield = this.calculateNetYield(property);

    return {
      propertyId: property.id,
      bestFor: this.detectBestFor(property, grossYield),
      pros: this.detectPros(property, grossYield),
      cons: this.detectCons(property, netYield),
      risks: this.detectRisks(property, grossYield),
      questionsToAskAgent: this.buildQuestions(property),
      confidence: this.detectConfidence(property),
      generatedFrom: [
        "property-price",
        "property-location",
        "property-size",
        "amenities",
        "rent-estimate",
        "maintenance-fee"
      ]
    };
  }

  private detectBestFor(property: PropertySnapshot, grossYield?: number): PropertyPurpose[] {
    const bestFor = new Set<PropertyPurpose>();

    if (grossYield !== undefined && grossYield >= 0.06) {
      bestFor.add("investment");
    }

    if ((property.beachDistanceMeters ?? Number.POSITIVE_INFINITY) <= 1000) {
      bestFor.add("living");
      bestFor.add("relocation");
    }

    if (property.bedrooms >= 2 || property.areaSqm >= 70) {
      bestFor.add("family");
    }

    if (bestFor.size === 0) {
      bestFor.add("living");
    }

    return [...bestFor];
  }

  private detectPros(property: PropertySnapshot, grossYield?: number): string[] {
    const pros: string[] = [];

    if ((property.beachDistanceMeters ?? Number.POSITIVE_INFINITY) <= 800) {
      pros.push("Close to the beach for winter living and short-term rental demand.");
    }

    if (property.amenities.includes("pool")) {
      pros.push("Pool amenity improves lifestyle appeal and rental presentation.");
    }

    if (property.amenities.includes("gym")) {
      pros.push("Gym amenity is useful for long-stay tenants and relocation buyers.");
    }

    if (property.amenities.includes("sea-view")) {
      pros.push("Sea view can support stronger resale and rental positioning.");
    }

    if (property.amenities.includes("fast-internet")) {
      pros.push("Fast internet signal fits remote workers and winter residents.");
    }

    if (grossYield !== undefined && grossYield >= 0.06) {
      pros.push(`Estimated gross yield is ${(grossYield * 100).toFixed(1)}%, which is investment-friendly.`);
    }

    if (property.areaSqm >= 45 && property.bedrooms <= 1) {
      pros.push("Good area-to-bedroom ratio for comfortable personal use.");
    }

    return pros.length ? pros : ["Core listing data is complete enough for an initial review."];
  }

  private detectCons(property: PropertySnapshot, netYield?: number): string[] {
    const cons: string[] = [];

    if (property.floor !== undefined && property.floor <= 2) {
      cons.push("Low floor may be less attractive for view-sensitive buyers.");
    }

    if ((property.beachDistanceMeters ?? 0) > 1500) {
      cons.push("Beach distance may reduce appeal for holiday rental demand.");
    }

    if (property.maintenanceFeeMonthly && property.monthlyRentEstimate) {
      const feeShare = property.maintenanceFeeMonthly.amount / property.monthlyRentEstimate.amount;

      if (feeShare >= 0.15) {
        cons.push("Maintenance fee takes a noticeable share of expected monthly rent.");
      }
    }

    if (netYield !== undefined && netYield < 0.04) {
      cons.push(`Estimated net yield is only ${(netYield * 100).toFixed(1)}% after known annualized costs.`);
    }

    return cons;
  }

  private detectRisks(property: PropertySnapshot, grossYield?: number): string[] {
    const risks: string[] = [];

    if (!property.monthlyRentEstimate) {
      risks.push("Missing rent estimate makes investment yield uncertain.");
    }

    if (!property.maintenanceFeeMonthly) {
      risks.push("Missing maintenance fee makes ownership cost incomplete.");
    }

    if (grossYield !== undefined && grossYield < 0.04) {
      risks.push("Estimated gross yield is below a typical investment target.");
    }

    if (!property.beachDistanceMeters) {
      risks.push("Beach distance is unknown, so lifestyle and rental positioning need manual validation.");
    }

    return risks;
  }

  private buildQuestions(property: PropertySnapshot): string[] {
    const questions = [
      "What is the exact foreign quota status for this unit?",
      "What are the current common area fees and sinking fund terms?",
      "Are short-term rentals allowed by the building rules?"
    ];

    if (!property.monthlyRentEstimate) {
      questions.push("What are comparable long-term and short-term rental rates in this building?");
    }

    if (property.amenities.includes("sea-view")) {
      questions.push("Is the sea view protected, or could future construction block it?");
    }

    return questions;
  }

  private detectConfidence(property: PropertySnapshot): AiAdvisorSummary["confidence"] {
    const availableSignals = [
      property.price,
      property.location,
      property.areaSqm,
      property.bedrooms !== undefined,
      property.bathrooms !== undefined,
      property.beachDistanceMeters,
      property.monthlyRentEstimate,
      property.maintenanceFeeMonthly,
      property.amenities.length > 0
    ].filter(Boolean).length;

    if (availableSignals >= 8) {
      return "high";
    }

    if (availableSignals >= 5) {
      return "medium";
    }

    return "low";
  }

  private calculateGrossYield(property: PropertySnapshot): number | undefined {
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

  private calculateNetYield(property: PropertySnapshot): number | undefined {
    if (!property.monthlyRentEstimate || !property.maintenanceFeeMonthly) {
      return undefined;
    }

    return calculateNetYield({
      propertyId: property.id,
      purchasePrice: property.price,
      monthlyRent: property.monthlyRentEstimate,
      occupancyRate: 0.85,
      annualCosts: {
        amount: property.maintenanceFeeMonthly.amount * 12,
        currency: property.price.currency
      }
    });
  }
}

