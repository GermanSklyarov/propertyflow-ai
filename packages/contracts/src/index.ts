import type {
  GeoPoint,
  Money,
  PropertyKind,
  PropertyPurpose,
  PropertySnapshot,
  ThailandMarket
} from "@propertyflow/domain";

export interface TenantSnapshot {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  primaryMarket?: ThailandMarket;
  branding: {
    displayName: string;
    primaryColor?: string;
    logoUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type UserRole = "agent" | "broker" | "manager" | "admin";

export interface RequestUser {
  id: string;
  tenantId: string;
  role: UserRole;
}

export type AuditAction =
  | "property.created"
  | "property.ai_search"
  | "property.compared"
  | "tenant.current_viewed";

export interface AuditEventSnapshot {
  id: string;
  tenantId: string;
  userId?: string;
  userRole?: UserRole;
  action: AuditAction;
  resourceType: "property" | "tenant" | "search" | "comparison";
  resourceId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PublicApiKeySnapshot {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  status: "active" | "revoked";
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
}

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
  confidence: "low" | "medium" | "high";
  generatedFrom: string[];
}

export interface InvestmentAnalysis {
  propertyId: string;
  purchasePrice: Money;
  monthlyRentEstimate?: Money;
  occupancyRate: number;
  annualGrossRent?: Money;
  annualKnownCosts: Money;
  monthlyKnownCosts: Money;
  grossYield?: number;
  netYield?: number;
  paybackYears?: number;
  assumptions: string[];
  warnings: string[];
}

export type NeighborhoodPoiCategory =
  | "beach"
  | "restaurant"
  | "shopping"
  | "transport"
  | "hospital"
  | "school"
  | "coworking"
  | "nightlife";

export interface NeighborhoodPoi {
  name: string;
  category: NeighborhoodPoiCategory;
  location: GeoPoint;
  distanceMeters: number;
}

export interface NeighborhoodScore {
  category: NeighborhoodPoiCategory;
  label: string;
  score: number;
  nearestDistanceMeters?: number;
}

export interface NeighborhoodIntelligence {
  propertyId: string;
  market: ThailandMarket;
  summary: string;
  walkabilityScore: number;
  scores: NeighborhoodScore[];
  nearestPois: NeighborhoodPoi[];
  signals: string[];
}

export interface ComparePropertiesRequest {
  propertyIds: string[];
}

export interface PropertyComparisonScore {
  propertyId: string;
  title: string;
  purpose: PropertyPurpose;
  score: number;
  reasons: string[];
}

export interface PropertyComparisonWinner {
  purpose: PropertyPurpose;
  propertyId: string;
  title: string;
  score: number;
  explanation: string;
}

export interface PropertyComparisonResponse {
  comparedPropertyIds: string[];
  scores: PropertyComparisonScore[];
  winners: PropertyComparisonWinner[];
  summary: string;
}

export interface PropertyPriceHistoryPoint {
  effectiveDate: string;
  price: Money;
  source: "initial-listing" | "agent-update" | "import" | "fallback-current-price";
}

export interface PropertyPriceHistory {
  propertyId: string;
  currentPrice: Money;
  points: PropertyPriceHistoryPoint[];
  changeAmount?: Money;
  changePercent?: number;
  trend: "up" | "down" | "flat" | "insufficient-data";
  summary: string;
}

export interface RentalYieldSummary {
  propertyId: string;
  price: Money;
  monthlyRentEstimate?: Money;
  annualGrossRent?: Money;
  grossYield?: number;
  netYield?: number;
  occupancyRate: number;
  confidence: "low" | "medium" | "high";
  label: "strong" | "moderate" | "weak" | "unknown";
  summary: string;
  warnings: string[];
}
