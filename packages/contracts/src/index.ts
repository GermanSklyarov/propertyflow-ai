import type {
  GeoPoint,
  Money,
  PropertyKind,
  PropertyPurpose,
  PropertySnapshot,
  ThailandMarket
} from "@propertyflow/domain";

export interface CreatePropertyRequest {
  title: string;
  description?: string;
  kind: PropertyKind;
  market: ThailandMarket;
  price: Money;
  location: GeoPoint;
  address?: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  floor?: number;
  beachDistanceMeters?: number;
  monthlyRentEstimate?: Money;
  maintenanceFeeMonthly?: Money;
  amenities?: string[];
}

export interface PropertyListResponse {
  items: PropertySnapshot[];
}

export interface PropertySearchRequest {
  market?: ThailandMarket;
  minPriceThb?: number;
  maxPriceThb?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minAreaSqm?: number;
  maxBeachDistanceMeters?: number;
  requiredAmenities?: string[];
  near?: GeoPoint;
  radiusMeters?: number;
}

export interface PropertySearchResponse {
  items: PropertySnapshot[];
  total: number;
  filters: PropertySearchRequest;
}

export interface NaturalLanguageSearchRequest {
  locale: "en" | "ru" | "th" | "zh";
  query: string;
  market?: ThailandMarket;
  purpose?: PropertyPurpose;
}

export interface PropertySearchFilters {
  market?: ThailandMarket;
  minPriceThb?: number;
  maxPriceThb?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minAreaSqm?: number;
  maxBeachDistanceMeters?: number;
  near?: GeoPoint;
  radiusMeters?: number;
  requiredAmenities?: string[];
  lifestyleSignals?: string[];
  investmentSignals?: string[];
}

export interface NaturalLanguageSearchResponse {
  interpretedIntent: string;
  filters: PropertySearchFilters;
  rankingExplanation: string;
}

export interface NaturalLanguagePropertySearchResponse extends NaturalLanguageSearchResponse {
  items: PropertySnapshot[];
  total: number;
}

export interface AiAdvisorSummary {
  propertyId: string;
  bestFor: PropertyPurpose[];
  pros: string[];
  cons: string[];
  risks: string[];
  questionsToAskAgent: string[];
}
