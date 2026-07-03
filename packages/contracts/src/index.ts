import type { PropertyPurpose, ThailandMarket } from "@propertyflow/domain";

export interface NaturalLanguageSearchRequest {
  tenantId: string;
  locale: "en" | "ru" | "th" | "zh";
  query: string;
  market?: ThailandMarket;
  purpose?: PropertyPurpose;
}

export interface PropertySearchFilters {
  market?: ThailandMarket;
  maxPriceThb?: number;
  minBedrooms?: number;
  maxBeachDistanceMeters?: number;
  requiredAmenities?: string[];
  lifestyleSignals?: string[];
  investmentSignals?: string[];
}

export interface NaturalLanguageSearchResponse {
  interpretedIntent: string;
  filters: PropertySearchFilters;
  rankingExplanation: string;
}

export interface AiAdvisorSummary {
  propertyId: string;
  bestFor: PropertyPurpose[];
  pros: string[];
  cons: string[];
  risks: string[];
  questionsToAskAgent: string[];
}

