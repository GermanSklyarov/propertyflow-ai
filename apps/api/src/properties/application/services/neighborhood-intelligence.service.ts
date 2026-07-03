import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  NeighborhoodIntelligence,
  NeighborhoodPoi,
  NeighborhoodPoiCategory,
  NeighborhoodScore
} from "@propertyflow/contracts";
import type { GeoPoint, PropertySnapshot, ThailandMarket } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

interface SeedPoi {
  name: string;
  category: NeighborhoodPoiCategory;
  market: ThailandMarket;
  location: GeoPoint;
}

const SEED_POIS: SeedPoi[] = [
  {
    name: "Pattaya Beach",
    category: "beach",
    market: "pattaya",
    location: { latitude: 12.9366, longitude: 100.8834 }
  },
  {
    name: "Terminal 21 Pattaya",
    category: "shopping",
    market: "pattaya",
    location: { latitude: 12.9497, longitude: 100.889 }
  },
  {
    name: "Central Pattaya",
    category: "shopping",
    market: "pattaya",
    location: { latitude: 12.9346, longitude: 100.8826 }
  },
  {
    name: "Bangkok Hospital Pattaya",
    category: "hospital",
    market: "pattaya",
    location: { latitude: 12.9492, longitude: 100.9066 }
  },
  {
    name: "Jomtien Beach",
    category: "beach",
    market: "pattaya",
    location: { latitude: 12.8906, longitude: 100.8697 }
  },
  {
    name: "Phuket Old Town",
    category: "restaurant",
    market: "phuket",
    location: { latitude: 7.8841, longitude: 98.3891 }
  },
  {
    name: "Central Phuket",
    category: "shopping",
    market: "phuket",
    location: { latitude: 7.8912, longitude: 98.3684 }
  },
  {
    name: "Patong Beach",
    category: "beach",
    market: "phuket",
    location: { latitude: 7.8965, longitude: 98.2966 }
  },
  {
    name: "Bangkok Hospital Phuket",
    category: "hospital",
    market: "phuket",
    location: { latitude: 7.9078, longitude: 98.3783 }
  },
  {
    name: "BTS Asok",
    category: "transport",
    market: "bangkok",
    location: { latitude: 13.737, longitude: 100.5604 }
  },
  {
    name: "Terminal 21 Bangkok",
    category: "shopping",
    market: "bangkok",
    location: { latitude: 13.7377, longitude: 100.5602 }
  },
  {
    name: "Benjakitti Park",
    category: "restaurant",
    market: "bangkok",
    location: { latitude: 13.7296, longitude: 100.5581 }
  },
  {
    name: "Bangkok Hospital",
    category: "hospital",
    market: "bangkok",
    location: { latitude: 13.7488, longitude: 100.5838 }
  },
  {
    name: "Hua Hin Beach",
    category: "beach",
    market: "hua-hin",
    location: { latitude: 12.5684, longitude: 99.9577 }
  },
  {
    name: "Bluport Hua Hin",
    category: "shopping",
    market: "hua-hin",
    location: { latitude: 12.5488, longitude: 99.9622 }
  },
  {
    name: "Fisherman's Village",
    category: "restaurant",
    market: "koh-samui",
    location: { latitude: 9.5608, longitude: 100.0312 }
  },
  {
    name: "Chaweng Beach",
    category: "beach",
    market: "koh-samui",
    location: { latitude: 9.5275, longitude: 100.0644 }
  },
  {
    name: "Central Samui",
    category: "shopping",
    market: "koh-samui",
    location: { latitude: 9.5315, longitude: 100.0617 }
  }
];

const SCORE_CATEGORIES: Array<{ category: NeighborhoodPoiCategory; label: string; maxDistanceMeters: number }> = [
  { category: "beach", label: "Beach", maxDistanceMeters: 2000 },
  { category: "restaurant", label: "Restaurants", maxDistanceMeters: 1500 },
  { category: "shopping", label: "Shopping", maxDistanceMeters: 2500 },
  { category: "transport", label: "Public transport", maxDistanceMeters: 1200 },
  { category: "hospital", label: "Hospitals", maxDistanceMeters: 5000 },
  { category: "school", label: "Schools", maxDistanceMeters: 5000 },
  { category: "coworking", label: "Coworking", maxDistanceMeters: 2500 },
  { category: "nightlife", label: "Nightlife", maxDistanceMeters: 2000 }
];

@Injectable()
export class NeighborhoodIntelligenceService {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  async analyze(tenantId: string, propertyId: string): Promise<NeighborhoodIntelligence> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const nearestPois = this.findNearestPois(property);
    const scores = this.calculateScores(nearestPois);
    const walkabilityScore = this.calculateWalkabilityScore(scores);

    return {
      propertyId: property.id,
      market: property.market,
      summary: this.buildSummary(property, scores, walkabilityScore),
      walkabilityScore,
      scores,
      nearestPois,
      signals: this.detectSignals(property, scores)
    };
  }

  private findNearestPois(property: PropertySnapshot): NeighborhoodPoi[] {
    return SEED_POIS.filter((poi) => poi.market === property.market)
      .map((poi) => ({
        name: poi.name,
        category: poi.category,
        location: poi.location,
        distanceMeters: Math.round(this.distanceMeters(property.location, poi.location))
      }))
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, 8);
  }

  private calculateScores(nearestPois: NeighborhoodPoi[]): NeighborhoodScore[] {
    return SCORE_CATEGORIES.map(({ category, label, maxDistanceMeters }) => {
      const nearestDistanceMeters = nearestPois
        .filter((poi) => poi.category === category)
        .map((poi) => poi.distanceMeters)
        .sort((left, right) => left - right)[0];

      return {
        category,
        label,
        score: this.scoreDistance(nearestDistanceMeters, maxDistanceMeters),
        nearestDistanceMeters
      };
    });
  }

  private calculateWalkabilityScore(scores: NeighborhoodScore[]): number {
    const relevantScores = scores.filter((score) => score.score > 0);

    if (!relevantScores.length) {
      return 1;
    }

    const average = relevantScores.reduce((sum, score) => sum + score.score, 0) / relevantScores.length;
    return Math.round(average * 10) / 10;
  }

  private scoreDistance(distanceMeters: number | undefined, maxDistanceMeters: number): number {
    if (distanceMeters === undefined) {
      return 0;
    }

    if (distanceMeters <= maxDistanceMeters * 0.25) {
      return 5;
    }

    if (distanceMeters <= maxDistanceMeters * 0.5) {
      return 4;
    }

    if (distanceMeters <= maxDistanceMeters) {
      return 3;
    }

    if (distanceMeters <= maxDistanceMeters * 1.75) {
      return 2;
    }

    return 1;
  }

  private buildSummary(property: PropertySnapshot, scores: NeighborhoodScore[], walkabilityScore: number): string {
    const strongest = scores
      .filter((score) => score.score >= 4)
      .map((score) => score.label.toLowerCase())
      .slice(0, 3);

    if (strongest.length) {
      return `${property.market} location with strong access to ${strongest.join(", ")}. Walkability score: ${walkabilityScore}/5.`;
    }

    return `${property.market} location with limited nearby POI data in v1. Walkability score: ${walkabilityScore}/5.`;
  }

  private detectSignals(property: PropertySnapshot, scores: NeighborhoodScore[]): string[] {
    const signals: string[] = [];
    const scoreByCategory = new Map(scores.map((score) => [score.category, score.score]));

    if ((scoreByCategory.get("beach") ?? 0) >= 4 || (property.beachDistanceMeters ?? Number.POSITIVE_INFINITY) <= 1000) {
      signals.push("beach-life");
    }

    if ((scoreByCategory.get("shopping") ?? 0) >= 4) {
      signals.push("shopping-access");
    }

    if ((scoreByCategory.get("hospital") ?? 0) >= 3) {
      signals.push("healthcare-access");
    }

    if ((scoreByCategory.get("transport") ?? 0) >= 4) {
      signals.push("transit-friendly");
    }

    if (property.amenities.includes("fast-internet")) {
      signals.push("remote-work-ready");
    }

    return signals;
  }

  private distanceMeters(from: GeoPoint, to: GeoPoint): number {
    const earthRadiusMeters = 6_371_000;
    const fromLatitude = this.toRadians(from.latitude);
    const toLatitude = this.toRadians(to.latitude);
    const latitudeDelta = this.toRadians(to.latitude - from.latitude);
    const longitudeDelta = this.toRadians(to.longitude - from.longitude);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

    return earthRadiusMeters * centralAngle;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}

