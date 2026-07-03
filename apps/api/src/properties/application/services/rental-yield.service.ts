import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { RentalYieldSummary } from "@propertyflow/contracts";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";
import { InvestmentCalculatorService } from "./investment-calculator.service.js";

@Injectable()
export class RentalYieldService {
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(InvestmentCalculatorService) private readonly investmentCalculator: InvestmentCalculatorService
  ) {}

  async summarize(tenantId: string, propertyId: string): Promise<RentalYieldSummary> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const investment = this.investmentCalculator.analyzeProperty(property);

    return {
      propertyId: property.id,
      price: property.price,
      monthlyRentEstimate: investment.monthlyRentEstimate,
      annualGrossRent: investment.annualGrossRent,
      grossYield: investment.grossYield,
      netYield: investment.netYield,
      occupancyRate: investment.occupancyRate,
      confidence: this.detectConfidence(investment),
      label: this.detectLabel(investment.netYield ?? investment.grossYield),
      summary: this.buildSummary(investment.netYield ?? investment.grossYield),
      warnings: investment.warnings
    };
  }

  private detectConfidence(investment: ReturnType<InvestmentCalculatorService["analyzeProperty"]>): RentalYieldSummary["confidence"] {
    if (investment.monthlyRentEstimate && investment.netYield !== undefined && !investment.warnings.length) {
      return "high";
    }

    if (investment.monthlyRentEstimate && investment.grossYield !== undefined) {
      return "medium";
    }

    return "low";
  }

  private detectLabel(yieldValue: number | undefined): RentalYieldSummary["label"] {
    if (yieldValue === undefined) {
      return "unknown";
    }

    if (yieldValue >= 0.06) {
      return "strong";
    }

    if (yieldValue >= 0.04) {
      return "moderate";
    }

    return "weak";
  }

  private buildSummary(yieldValue: number | undefined): string {
    if (yieldValue === undefined) {
      return "Rental yield cannot be calculated without a monthly rent estimate.";
    }

    return `Estimated rental yield is ${(yieldValue * 100).toFixed(1)}%, classified as ${this.detectLabel(yieldValue)}.`;
  }
}

