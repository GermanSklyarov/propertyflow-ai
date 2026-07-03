import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { InvestmentAnalysis } from "@propertyflow/contracts";
import type { Money, PropertySnapshot } from "@propertyflow/domain";
import { calculateGrossYield, calculateNetYield } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

const DEFAULT_OCCUPANCY_RATE = 0.85;

@Injectable()
export class InvestmentCalculatorService {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  async analyze(tenantId: string, propertyId: string): Promise<InvestmentAnalysis> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    return this.analyzeProperty(property);
  }

  analyzeProperty(property: PropertySnapshot): InvestmentAnalysis {
    const annualKnownCosts = this.calculateAnnualKnownCosts(property);
    const monthlyKnownCosts = this.toMoney(annualKnownCosts.amount / 12, annualKnownCosts.currency);
    const annualGrossRent = property.monthlyRentEstimate
      ? this.toMoney(property.monthlyRentEstimate.amount * 12 * DEFAULT_OCCUPANCY_RATE, property.monthlyRentEstimate.currency)
      : undefined;
    const grossYield = property.monthlyRentEstimate
      ? calculateGrossYield({
          propertyId: property.id,
          purchasePrice: property.price,
          monthlyRent: property.monthlyRentEstimate,
          occupancyRate: DEFAULT_OCCUPANCY_RATE,
          annualCosts: this.toMoney(0, property.price.currency)
        })
      : undefined;
    const netYield = property.monthlyRentEstimate
      ? calculateNetYield({
          propertyId: property.id,
          purchasePrice: property.price,
          monthlyRent: property.monthlyRentEstimate,
          occupancyRate: DEFAULT_OCCUPANCY_RATE,
          annualCosts: annualKnownCosts
        })
      : undefined;

    return {
      propertyId: property.id,
      purchasePrice: property.price,
      monthlyRentEstimate: property.monthlyRentEstimate,
      occupancyRate: DEFAULT_OCCUPANCY_RATE,
      annualGrossRent,
      annualKnownCosts,
      monthlyKnownCosts,
      grossYield,
      netYield,
      paybackYears: netYield && netYield > 0 ? 1 / netYield : undefined,
      assumptions: this.buildAssumptions(property),
      warnings: this.buildWarnings(property, grossYield, netYield)
    };
  }

  private calculateAnnualKnownCosts(property: PropertySnapshot): Money {
    return this.toMoney((property.maintenanceFeeMonthly?.amount ?? 0) * 12, property.price.currency);
  }

  private buildAssumptions(property: PropertySnapshot): string[] {
    const assumptions = [`Occupancy rate is fixed at ${(DEFAULT_OCCUPANCY_RATE * 100).toFixed(0)}% for v1 analysis.`];

    if (property.maintenanceFeeMonthly) {
      assumptions.push("Known annual costs include monthly maintenance fee only.");
    } else {
      assumptions.push("Known annual costs do not include maintenance fee because it is missing.");
    }

    assumptions.push("Taxes, agency fees, renovation, vacancy spikes, and financing are not included yet.");

    return assumptions;
  }

  private buildWarnings(property: PropertySnapshot, grossYield?: number, netYield?: number): string[] {
    const warnings: string[] = [];

    if (!property.monthlyRentEstimate) {
      warnings.push("Monthly rent estimate is missing, so yield and payback cannot be calculated.");
    }

    if (!property.maintenanceFeeMonthly) {
      warnings.push("Maintenance fee is missing, so net yield may be overstated.");
    }

    if (grossYield !== undefined && grossYield < 0.04) {
      warnings.push("Gross yield is below 4%, which may be weak for an investment-first purchase.");
    }

    if (netYield !== undefined && netYield < 0.04) {
      warnings.push("Net yield is below 4% based on known costs.");
    }

    return warnings;
  }

  private toMoney(amount: number, currency: Money["currency"]): Money {
    return {
      amount: Math.round(amount * 100) / 100,
      currency
    };
  }
}

