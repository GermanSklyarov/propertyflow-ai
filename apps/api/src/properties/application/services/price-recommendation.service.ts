import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Money, PropertySnapshot } from "@propertyflow/domain";
import type { PricingModelRegistryResponse, PropertyPriceComparable, PropertyPriceRecommendation } from "@propertyflow/contracts";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

const PRICE_RECOMMENDATION_ENGINE = "baseline-comparables";
const PRICE_RECOMMENDATION_MODEL_VERSION = "baseline-comparables-v1";
const PRICE_RECOMMENDATION_FEATURES = [
  "market",
  "propertyKind",
  "currency",
  "areaSqm",
  "bedrooms",
  "bathrooms",
  "beachDistanceMeters",
  "amenities",
  "floor",
  "comparablePricePerSqm",
  "comparableSimilarityScore"
];

interface ComparableCandidate {
  property: PropertySnapshot;
  pricePerSqm: number;
  similarityScore: number;
}

@Injectable()
export class PriceRecommendationService {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  registry(): PricingModelRegistryResponse {
    return {
      activeModelVersion: PRICE_RECOMMENDATION_MODEL_VERSION,
      models: [
        {
          ...this.modelMetadata(),
          active: true,
          description:
            "Explainable baseline using weighted comparable listings and deterministic amenity/location adjustments. This is not a trained ML model yet."
        }
      ],
      generatedAt: new Date().toISOString()
    };
  }

  async recommend(tenantId: string, propertyId: string): Promise<PropertyPriceRecommendation> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const candidates = (await this.properties.list(tenantId))
      .filter((candidate) => candidate.id !== property.id)
      .filter((candidate) => candidate.market === property.market)
      .filter((candidate) => candidate.kind === property.kind)
      .filter((candidate) => candidate.price.currency === property.price.currency)
      .filter((candidate) => candidate.areaSqm > 0)
      .map((candidate) => this.toCandidate(property, candidate))
      .filter((candidate) => candidate.similarityScore >= 0.45)
      .sort((left, right) => right.similarityScore - left.similarityScore)
      .slice(0, 8);

    const currentPricePerSqm = this.money(property.price.amount / property.areaSqm, property.price.currency);

    if (!candidates.length) {
      return {
        propertyId: property.id,
        ...this.modelMetadata(),
        currentPrice: property.price,
        currentPricePerSqm,
        suggestedPrice: property.price,
        suggestedRange: {
          min: property.price,
          max: property.price
        },
        pricePerSqmBenchmark: currentPricePerSqm,
        position: "insufficient-data",
        confidence: "low",
        comparableProperties: [],
        rationale: ["No sufficiently similar tenant listings were found for this market, property kind, and currency."],
        warnings: ["Recommendation falls back to the current listing price until more comparable listings are available."],
        generatedAt: new Date().toISOString()
      };
    }

    const benchmark = this.weightedPricePerSqm(candidates);
    const adjustedBenchmark = benchmark * this.adjustmentFactor(property);
    const suggestedAmount = adjustedBenchmark * property.areaSqm;
    const suggestedPrice = this.money(suggestedAmount, property.price.currency);
    const suggestedRange = {
      min: this.money(suggestedAmount * 0.93, property.price.currency),
      max: this.money(suggestedAmount * 1.07, property.price.currency)
    };

    return {
      propertyId: property.id,
      ...this.modelMetadata(),
      currentPrice: property.price,
      currentPricePerSqm,
      suggestedPrice,
      suggestedRange,
      pricePerSqmBenchmark: this.money(adjustedBenchmark, property.price.currency),
      position: this.position(property.price.amount, suggestedRange.min.amount, suggestedRange.max.amount),
      confidence: this.confidence(candidates),
      comparableProperties: candidates.map((candidate) => this.toComparable(candidate)),
      rationale: this.rationale(property, candidates, benchmark, adjustedBenchmark),
      warnings: this.warnings(property, candidates),
      generatedAt: new Date().toISOString()
    };
  }

  private toCandidate(target: PropertySnapshot, property: PropertySnapshot): ComparableCandidate {
    return {
      property,
      pricePerSqm: property.price.amount / property.areaSqm,
      similarityScore: this.similarityScore(target, property)
    };
  }

  private modelMetadata(): Pick<
    PropertyPriceRecommendation,
    "engine" | "modelVersion" | "predictionTarget" | "trainingStatus" | "featuresUsed"
  > {
    return {
      engine: PRICE_RECOMMENDATION_ENGINE,
      modelVersion: PRICE_RECOMMENDATION_MODEL_VERSION,
      predictionTarget: "sale_price",
      trainingStatus: "not-trained",
      featuresUsed: PRICE_RECOMMENDATION_FEATURES
    };
  }

  private similarityScore(target: PropertySnapshot, candidate: PropertySnapshot): number {
    let score = 0.35;

    score += Math.max(0, 0.2 - Math.abs(target.areaSqm - candidate.areaSqm) / Math.max(target.areaSqm, 1) * 0.2);
    score += target.bedrooms === candidate.bedrooms ? 0.15 : Math.max(0, 0.1 - Math.abs(target.bedrooms - candidate.bedrooms) * 0.05);
    score += target.bathrooms === candidate.bathrooms ? 0.08 : 0;

    if (target.beachDistanceMeters !== undefined && candidate.beachDistanceMeters !== undefined) {
      score += Math.max(0, 0.12 - Math.abs(target.beachDistanceMeters - candidate.beachDistanceMeters) / 5000);
    }

    const sharedAmenities = target.amenities.filter((amenity) => candidate.amenities.includes(amenity)).length;
    score += Math.min(0.1, sharedAmenities * 0.025);

    return Math.round(Math.min(score, 1) * 100) / 100;
  }

  private weightedPricePerSqm(candidates: ComparableCandidate[]): number {
    const weightedSum = candidates.reduce((sum, candidate) => sum + candidate.pricePerSqm * candidate.similarityScore, 0);
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.similarityScore, 0);

    return weightedSum / totalWeight;
  }

  private adjustmentFactor(property: PropertySnapshot): number {
    let factor = 1;

    if ((property.beachDistanceMeters ?? Number.POSITIVE_INFINITY) <= 500) {
      factor += 0.04;
    }

    if (property.amenities.includes("sea-view")) {
      factor += 0.05;
    }

    if (property.amenities.includes("pool")) {
      factor += 0.02;
    }

    if (property.amenities.includes("fast-internet")) {
      factor += 0.01;
    }

    if (property.floor !== undefined && property.floor >= 10) {
      factor += 0.02;
    }

    return factor;
  }

  private position(currentAmount: number, minAmount: number, maxAmount: number): PropertyPriceRecommendation["position"] {
    if (currentAmount < minAmount) {
      return "underpriced";
    }

    if (currentAmount > maxAmount) {
      return "overpriced";
    }

    return "fair";
  }

  private confidence(candidates: ComparableCandidate[]): PropertyPriceRecommendation["confidence"] {
    if (candidates.length >= 5 && candidates[0].similarityScore >= 0.75) {
      return "high";
    }

    if (candidates.length >= 3) {
      return "medium";
    }

    return "low";
  }

  private rationale(
    property: PropertySnapshot,
    candidates: ComparableCandidate[],
    benchmark: number,
    adjustedBenchmark: number
  ): string[] {
    const rationale = [
      `Used ${candidates.length} comparable ${property.kind} listing${candidates.length === 1 ? "" : "s"} in ${property.market}.`,
      `Weighted comparable benchmark is ${this.money(benchmark, property.price.currency).amount} ${property.price.currency}/sqm.`
    ];

    if (adjustedBenchmark !== benchmark) {
      rationale.push(`Adjusted benchmark to ${this.money(adjustedBenchmark, property.price.currency).amount} ${property.price.currency}/sqm for location and amenity signals.`);
    }

    return rationale;
  }

  private warnings(property: PropertySnapshot, candidates: ComparableCandidate[]): string[] {
    const warnings: string[] = [];

    if (candidates.length < 3) {
      warnings.push("Comparable sample is small, so recommendation confidence is limited.");
    }

    if (!property.monthlyRentEstimate) {
      warnings.push("Monthly rent estimate is missing; recommendation does not cross-check investment yield.");
    }

    return warnings;
  }

  private toComparable(candidate: ComparableCandidate): PropertyPriceComparable {
    return {
      propertyId: candidate.property.id,
      title: candidate.property.title,
      price: candidate.property.price,
      areaSqm: candidate.property.areaSqm,
      pricePerSqm: this.money(candidate.pricePerSqm, candidate.property.price.currency),
      bedrooms: candidate.property.bedrooms,
      beachDistanceMeters: candidate.property.beachDistanceMeters,
      similarityScore: candidate.similarityScore
    };
  }

  private money(amount: number, currency: Money["currency"]): Money {
    return {
      amount: Math.round(amount * 100) / 100,
      currency
    };
  }
}
