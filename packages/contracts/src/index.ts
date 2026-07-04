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

export interface TenantUserSnapshot {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "inactive";
  createdAt: string;
}

export type AuditAction =
  | "property.created"
  | "property.ai_assistant"
  | "property.ai_search"
  | "property.compared"
  | "tenant.current_viewed"
  | "lead.created"
  | "lead.assigned"
  | "job.enqueued";

export interface AuditEventSnapshot {
  id: string;
  tenantId: string;
  userId?: string;
  userRole?: UserRole;
  action: AuditAction;
  resourceType: "property" | "tenant" | "search" | "comparison" | "lead" | "job";
  resourceId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type SearchEventSource = "structured" | "indexed" | "ai";

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

export const PROPERTY_SEARCH_INDEX = "propertyflow-properties-v1";

export interface IndexedPropertySearchRequest extends PropertySearchRequest {
  query?: string;
  limit?: number;
  offset?: number;
}

export interface IndexedPropertySearchHit {
  propertyId: string;
  score?: number;
  title: string;
  description?: string;
  market: ThailandMarket;
  kind: PropertyKind;
  status: PropertySnapshot["status"];
  price: Money;
  location: GeoPoint;
  address?: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  beachDistanceMeters?: number;
  amenities: string[];
  highlights: string[];
}

export interface IndexedPropertySearchResponse {
  items: IndexedPropertySearchHit[];
  total: number;
  filters: IndexedPropertySearchRequest;
  index: typeof PROPERTY_SEARCH_INDEX;
  tookMs?: number;
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

export interface RunListingAssistantRequest {
  generateDescriptions?: boolean;
  analyzeImages?: boolean;
  locales?: Array<"en" | "ru" | "th" | "zh">;
  imageUrls?: string[];
}

export interface RunListingAssistantResponse {
  propertyId: string;
  jobs: BackgroundJobSnapshot[];
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

export type LeadStatus = "new" | "contacted" | "qualified" | "lost" | "won";

export type LeadSource = "website" | "public-api" | "agent" | "ai-chat";

export interface CreateLeadRequest {
  propertyId?: string;
  source: LeadSource;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  message?: string;
  preferredLocale?: "en" | "ru" | "th" | "zh";
  assignedAgentId?: string;
  attributionSearchEventId?: string;
  attributionSearchQuery?: string;
  attributionSearchSource?: SearchEventSource;
}

export interface LeadSnapshot {
  id: string;
  tenantId: string;
  propertyId?: string;
  source: LeadSource;
  status: LeadStatus;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  message?: string;
  preferredLocale?: "en" | "ru" | "th" | "zh";
  assignedAgentId?: string;
  attributionSearchEventId?: string;
  attributionSearchQuery?: string;
  attributionSearchSource?: SearchEventSource;
  createdAt: string;
  updatedAt: string;
}

export interface AssignLeadRequest {
  assignedAgentId: string;
}

export interface LeadListResponse {
  items: LeadSnapshot[];
  total: number;
}

export interface CountByBucket {
  bucket: string;
  count: number;
}

export interface TenantDashboardMetrics {
  tenantId: string;
  totalProperties: number;
  availableProperties: number;
  totalLeads: number;
  newLeads: number;
  unassignedLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  totalSearches: number;
  attributedLeads: number;
  searchToLeadConversionRate: number;
  averageSearchLatencyMs: number;
  leadsBySource: CountByBucket[];
  leadsByStatus: CountByBucket[];
  searchesBySource: CountByBucket[];
  topSearchQueries: CountByBucket[];
  leadsByAttributedSearchSource: CountByBucket[];
  topLeadSearchQueries: CountByBucket[];
  generatedAt: string;
}

export type RealtimeEventType = "property.created" | "lead.created" | "lead.assigned";

export interface RealtimeEvent<TPayload = Record<string, unknown>> {
  type: RealtimeEventType;
  tenantId: string;
  payload: TPayload;
  occurredAt: string;
}

export const PROPERTYFLOW_JOBS_QUEUE = "propertyflow.jobs";

export type BackgroundJobName =
  | "properties.import"
  | "properties.ai_description.generate"
  | "properties.images.analyze"
  | "properties.search.index";

export interface BackgroundJobBasePayload {
  tenantId: string;
  requestedByUserId?: string;
}

export interface PropertyImportJobPayload extends BackgroundJobBasePayload {
  source: "csv" | "json" | "partner-api";
  objectUrl?: string;
  dryRun?: boolean;
}

export interface PropertyAiDescriptionJobPayload extends BackgroundJobBasePayload {
  propertyId: string;
  locales: Array<"en" | "ru" | "th" | "zh">;
}

export interface PropertyImageAnalysisJobPayload extends BackgroundJobBasePayload {
  propertyId: string;
  imageUrls: string[];
}

export interface PropertySearchIndexJobPayload extends BackgroundJobBasePayload {
  propertyId: string;
  reason: "created" | "updated" | "manual";
}

export type BackgroundJobPayload =
  | PropertyImportJobPayload
  | PropertyAiDescriptionJobPayload
  | PropertyImageAnalysisJobPayload
  | PropertySearchIndexJobPayload;

export interface EnqueueBackgroundJobRequest {
  name: BackgroundJobName;
  payload: BackgroundJobPayload;
}

export interface BackgroundJobSnapshot {
  id: string;
  name: BackgroundJobName;
  queue: typeof PROPERTYFLOW_JOBS_QUEUE;
  status: "queued";
  tenantId: string;
  createdAt: string;
}

export type BackgroundJobState =
  | "active"
  | "completed"
  | "delayed"
  | "failed"
  | "paused"
  | "prioritized"
  | "waiting"
  | "waiting-children";

export interface BackgroundJobMonitorItem {
  id: string;
  name: BackgroundJobName;
  queue: typeof PROPERTYFLOW_JOBS_QUEUE;
  state: BackgroundJobState | "unknown";
  tenantId: string;
  requestedByUserId?: string;
  attemptsMade: number;
  progress: boolean | number | string | object;
  createdAt?: string;
  processedAt?: string;
  finishedAt?: string;
  failedReason?: string;
  payload: BackgroundJobPayload;
}

export interface BackgroundJobMonitorResponse {
  items: BackgroundJobMonitorItem[];
  total: number;
  states: BackgroundJobState[];
}
