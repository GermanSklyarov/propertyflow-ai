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
  customDomain?: string;
  domainStatus?: "not-configured" | "pending-verification" | "verified";
  subscriptionPlan: "starter" | "growth" | "enterprise";
  limits: {
    properties: number;
    agents: number;
    aiCreditsMonthly: number;
    publicApiRequestsMonthly: number;
  };
  branding: {
    displayName: string;
    primaryColor?: string;
    logoUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTenantSettingsRequest {
  primaryMarket?: ThailandMarket;
  customDomain?: string;
  branding?: {
    displayName?: string;
    primaryColor?: string;
    logoUrl?: string;
  };
}

export type TenantUsageMetricKey = "properties" | "agents" | "aiCreditsMonthly" | "publicApiRequestsMonthly";

export interface TenantUsageMetric {
  key: TenantUsageMetricKey;
  used: number;
  limit: number;
  remaining: number;
  utilizationRate: number;
}

export interface TenantUsageResponse {
  tenantId: string;
  subscriptionPlan: TenantSnapshot["subscriptionPlan"];
  periodStart: string;
  periodEnd: string;
  items: TenantUsageMetric[];
  generatedAt: string;
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
  | "chat.asked"
  | "concierge.advised"
  | "concierge.feedback_submitted"
  | "concierge.lead_created"
  | "concierge.message_added"
  | "concierge.model_training_requested"
  | "concierge.session_created"
  | "concierge.training_dataset_viewed"
  | "knowledge.document_created"
  | "knowledge.document_embedding_requested"
  | "knowledge.document_ingestion_requested"
  | "pricing.model_training_requested"
  | "property.created"
  | "property.ai_assistant"
  | "property.ai_description_applied"
  | "property.ai_image_analysis_applied"
  | "property.ai_asset_reviewed"
  | "property.ai_search"
  | "property.compared"
  | "property.image_added"
  | "property.image_delete_previewed"
  | "property.image_removed"
  | "property.image_restored"
  | "property.published"
  | "property.price_recommendation_feedback"
  | "property.price_training_dataset_viewed"
  | "property.price_recommended"
  | "property.price_updated"
  | "property.status_changed"
  | "tenant.current_viewed"
  | "tenant.settings_updated"
  | "lead.created"
  | "lead.assigned"
  | "job.enqueued"
  | "job.enqueue_rejected";

export interface AuditEventSnapshot {
  id: string;
  tenantId: string;
  userId?: string;
  userRole?: UserRole;
  action: AuditAction;
  resourceType: "property" | "tenant" | "search" | "comparison" | "lead" | "job" | "knowledge";
  resourceId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ListAuditEventsRequest {
  action?: AuditAction;
  resourceType?: AuditEventSnapshot["resourceType"];
  resourceId?: string;
  userId?: string;
  limit?: number;
}

export interface AuditEventListResponse {
  items: AuditEventSnapshot[];
  total: number;
  filters: ListAuditEventsRequest;
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

export interface UpdatePropertyStatusRequest {
  status: PropertySnapshot["status"];
  note?: string;
}

export interface UpdatePropertyPriceRequest {
  price: Money;
  note?: string;
}

export interface PropertyStatusEventSnapshot {
  id: string;
  tenantId: string;
  propertyId: string;
  previousStatus: PropertySnapshot["status"];
  status: PropertySnapshot["status"];
  changedByUserId?: string;
  changedByUserRole?: UserRole;
  note?: string;
  createdAt: string;
}

export interface PropertyStatusHistoryResponse {
  propertyId: string;
  items: PropertyStatusEventSnapshot[];
}

export interface PropertyImageSnapshot {
  id: string;
  tenantId: string;
  propertyId: string;
  imageUrl: string;
  bucket?: string;
  objectKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  originalFilename?: string;
  caption?: string;
  position: number;
  createdAt: string;
  deletedAt?: string;
}

export interface PropertyImageDeletePreviewResponse {
  propertyId: string;
  image: PropertyImageSnapshot;
  confirmationToken: string;
  expiresAt: string;
  warnings: string[];
}

export interface ConfirmPropertyImageDeleteRequest {
  confirmationToken: string;
}

export interface AddPropertyImageRequest {
  imageUrl: string;
  bucket?: string;
  objectKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  originalFilename?: string;
  caption?: string;
  position?: number;
  analyzeImage?: boolean;
}

export interface CreatePropertyImageUploadRequest {
  filename: string;
  mimeType: string;
  sizeBytes?: number;
}

export interface CreatePropertyImageUploadResponse {
  bucket: string;
  objectKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresInSeconds: number;
}

export interface ConfirmPropertyImageUploadRequest {
  bucket?: string;
  objectKey: string;
  mimeType?: string;
  sizeBytes?: number;
  originalFilename?: string;
  caption?: string;
  position?: number;
  analyzeImage?: boolean;
}

export interface PropertyImageGalleryResponse {
  propertyId: string;
  images: PropertyImageSnapshot[];
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

export interface AiChatRequest {
  locale: "en" | "ru" | "th" | "zh";
  message: string;
  propertyId?: string;
  market?: ThailandMarket;
  purpose?: PropertyPurpose;
}

export interface AiChatCitation {
  source: "property" | "advisor" | "neighborhood" | "search" | "knowledge";
  propertyId?: string;
  documentId?: string;
  title?: string;
  label: string;
}

export interface AiChatResponse {
  id: string;
  message: string;
  answer: string;
  matchedPropertyIds: string[];
  citations: AiChatCitation[];
  suggestedActions: string[];
  createdAt: string;
}

export interface ConciergeProfile {
  market?: ThailandMarket;
  budgetThb?: number;
  familySize?: number;
  hasChildren?: boolean;
  hasCar?: boolean;
  remoteWork?: boolean;
  purpose?: PropertyPurpose;
  prefersQuiet?: boolean;
}

export interface ConciergeRequest {
  locale: "en" | "ru";
  message: string;
  profile?: ConciergeProfile;
}

export interface ConciergeQuestion {
  id: keyof ConciergeProfile;
  question: string;
  reason: string;
}

export interface ConciergePropertyRecommendation {
  propertyId: string;
  title: string;
  score: number;
  fit: "strong" | "moderate" | "weak";
  reasons: string[];
  tradeoffs: string[];
}

export interface ConciergeAreaRecommendation {
  area: string;
  market: ThailandMarket;
  fit: "strong" | "moderate" | "weak";
  reasons: string[];
  tradeoffs: string[];
}

export interface ConciergeResponse {
  id: string;
  stage: "intake" | "recommendation";
  profile: ConciergeProfile;
  nextQuestions: ConciergeQuestion[];
  areaRecommendation?: ConciergeAreaRecommendation;
  propertyRecommendations: ConciergePropertyRecommendation[];
  summary: string;
  createdAt: string;
}

export interface CreateConciergeSessionRequest extends ConciergeRequest {}

export interface AddConciergeSessionMessageRequest {
  message: string;
  profile?: ConciergeProfile;
}

export interface ConciergeSessionSnapshot {
  id: string;
  tenantId: string;
  userId?: string;
  locale: ConciergeRequest["locale"];
  status: "awaiting-input" | "recommended";
  profile: ConciergeProfile;
  latestResponse: ConciergeResponse;
  createdAt: string;
  updatedAt: string;
}

export interface ConciergeSessionMessageSnapshot {
  id: string;
  tenantId: string;
  sessionId: string;
  role: "user" | "assistant";
  message: string;
  response?: ConciergeResponse;
  profile?: ConciergeProfile;
  createdAt: string;
}

export interface ConciergeSessionDetailResponse {
  session: ConciergeSessionSnapshot;
  messages: ConciergeSessionMessageSnapshot[];
}

export interface CreateLeadFromConciergeSessionRequest {
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  message?: string;
  propertyId?: string;
  assignedAgentId?: string;
}

export interface ListConciergeSessionsRequest {
  status?: ConciergeSessionSnapshot["status"];
  userId?: string;
  limit?: number;
}

export interface ConciergeSessionListResponse {
  items: ConciergeSessionSnapshot[];
  total: number;
  filters: ListConciergeSessionsRequest;
}

export interface ConciergeAnalyticsResponse {
  tenantId: string;
  totalSessions: number;
  awaitingInputSessions: number;
  recommendedSessions: number;
  convertedLeads: number;
  feedbackCount: number;
  recommendationRate: number;
  leadConversionRate: number;
  positiveFeedbackRate: number;
  sessionsByPurpose: CountByBucket[];
  sessionsByMarket: CountByBucket[];
  recommendedAreas: CountByBucket[];
  feedbackByRating: CountByBucket[];
  generatedAt: string;
}

export type ConciergeFeedbackRating = "positive" | "neutral" | "negative";

export interface SubmitConciergeFeedbackRequest {
  rating: ConciergeFeedbackRating;
  areaAccurate?: boolean;
  propertyRecommendationsUseful?: boolean;
  selectedPropertyId?: string;
  note?: string;
}

export interface ConciergeFeedbackSnapshot {
  id: string;
  tenantId: string;
  sessionId: string;
  rating: ConciergeFeedbackRating;
  areaAccurate?: boolean;
  propertyRecommendationsUseful?: boolean;
  selectedPropertyId?: string;
  note?: string;
  createdByUserId?: string;
  createdByUserRole?: UserRole;
  createdAt: string;
}

export interface ConciergeTrainingDatasetRequest {
  limit?: number;
  rating?: ConciergeFeedbackRating;
  convertedOnly?: boolean;
}

export interface ConciergeTrainingDatasetRow {
  sessionId: string;
  locale: ConciergeRequest["locale"];
  profile: ConciergeProfile;
  recommendation: {
    stage: ConciergeResponse["stage"];
    area?: ConciergeAreaRecommendation;
    properties: ConciergePropertyRecommendation[];
    summary: string;
  };
  feedback?: {
    rating: ConciergeFeedbackRating;
    areaAccurate?: boolean;
    propertyRecommendationsUseful?: boolean;
    selectedPropertyId?: string;
    note?: string;
    createdAt: string;
  };
  label: {
    accepted: boolean;
    convertedToLead: boolean;
    selectedPropertyId?: string;
  };
  createdAt: string;
}

export interface ConciergeTrainingDatasetResponse {
  items: ConciergeTrainingDatasetRow[];
  total: number;
  generatedAt: string;
}

export interface ConciergeModelRegistryEntry {
  engine: "baseline-advisory" | "llm-reranker" | "learning-to-rank";
  modelVersion: string;
  predictionTarget: "area_recommendation" | "property_ranking" | "lead_conversion";
  trainingStatus: "not-trained" | "training" | "trained";
  featuresUsed: string[];
  active: boolean;
  description: string;
  trainedAt?: string;
  metrics?: {
    acceptanceRate?: number;
    leadConversionRate?: number;
    topKAccuracy?: number;
    sampleSize?: number;
  };
}

export interface ConciergeModelRegistryResponse {
  activeModelVersion: string;
  models: ConciergeModelRegistryEntry[];
  generatedAt: string;
}

export type KnowledgeDocumentKind = "article" | "neighborhood" | "relocation" | "legal" | "investment" | "faq";

export interface KnowledgeDocumentSnapshot {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  locale: "en" | "ru" | "th" | "zh";
  kind: KnowledgeDocumentKind;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocumentChunkSnapshot {
  id: string;
  tenantId: string;
  documentId: string;
  chunkIndex: number;
  title: string;
  content: string;
  locale: KnowledgeDocumentSnapshot["locale"];
  kind: KnowledgeDocumentKind;
  tags: string[];
  tokenEstimate: number;
  score: number;
  embeddingStatus: "pending" | "embedded" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeDocumentRequest {
  title: string;
  body: string;
  locale: KnowledgeDocumentSnapshot["locale"];
  kind: KnowledgeDocumentKind;
  tags?: string[];
}

export interface KnowledgeDocumentSearchRequest {
  query?: string;
  locale?: KnowledgeDocumentSnapshot["locale"];
  kind?: KnowledgeDocumentKind;
  limit?: number;
}

export interface KnowledgeDocumentListResponse {
  items: KnowledgeDocumentSnapshot[];
  total: number;
}

export interface KnowledgeChunkSearchRequest {
  query: string;
  locale?: KnowledgeDocumentSnapshot["locale"];
  kind?: KnowledgeDocumentKind;
  limit?: number;
}

export interface KnowledgeChunkSearchResponse {
  items: KnowledgeDocumentChunkSnapshot[];
  total: number;
  retrieval: "hybrid-chunks-v1" | "lexical-chunks-v1";
  generatedAt: string;
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

export type AiAgentActionName =
  | "property.ai_description.generate"
  | "property.images.analyze"
  | "property.ai_description.apply"
  | "property.ai_image_analysis.apply"
  | "property.image.delete"
  | "property.image.restore"
  | "property.publish"
  | "property.price.update";

export type AiAgentActionRisk = "background" | "mutating" | "destructive";

export type AiAgentActionPolicyDecision = "allowed" | "requires_human_confirmation" | "blocked";

export interface AiAgentActionPolicyItem {
  action: AiAgentActionName;
  risk: AiAgentActionRisk;
  decision: AiAgentActionPolicyDecision;
  reason: string;
  requiredRole?: UserRole;
  requiresConfirmationToken?: boolean;
}

export interface RunListingAssistantRequest {
  generateDescriptions?: boolean;
  analyzeImages?: boolean;
  locales?: Array<"en" | "ru" | "th" | "zh">;
  imageUrls?: string[];
  requestedActions?: AiAgentActionName[];
}

export interface RunListingAssistantResponse {
  propertyId: string;
  jobs: BackgroundJobSnapshot[];
  actionPolicy: AiAgentActionPolicyItem[];
}

export type AiAssetReviewStatus = "draft" | "approved" | "rejected";

export interface GeneratedPropertyDescription {
  id: string;
  propertyId: string;
  locale: "en" | "ru" | "th" | "zh";
  title: string;
  description: string;
  source: "ai-worker-v1";
  reviewStatus: AiAssetReviewStatus;
  reviewedByUserId?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
}

export interface PropertyImageAnalysisResult {
  id: string;
  propertyId: string;
  propertyImageId?: string;
  imageUrl: string;
  detectedFeatures: string[];
  confidence: number;
  reviewStatus: AiAssetReviewStatus;
  reviewedByUserId?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
}

export interface ReviewAiAssetRequest {
  status: Exclude<AiAssetReviewStatus, "draft">;
  note?: string;
}

export interface PropertyAiAssets {
  propertyId: string;
  descriptions: GeneratedPropertyDescription[];
  imageAnalysis: PropertyImageAnalysisResult[];
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

export interface UpdatePropertyPriceResponse {
  property: PropertySnapshot;
  pricePoint: PropertyPriceHistoryPoint;
}

export interface PropertyPriceComparable {
  propertyId: string;
  title: string;
  price: Money;
  areaSqm: number;
  pricePerSqm: Money;
  bedrooms: number;
  beachDistanceMeters?: number;
  similarityScore: number;
}

export interface PropertyPriceRecommendation {
  propertyId: string;
  engine: "baseline-comparables" | "ml-model";
  modelVersion: string;
  predictionTarget: "sale_price";
  trainingStatus: "not-trained" | "trained";
  featuresUsed: string[];
  currentPrice: Money;
  currentPricePerSqm: Money;
  suggestedPrice: Money;
  suggestedRange: {
    min: Money;
    max: Money;
  };
  pricePerSqmBenchmark: Money;
  position: "underpriced" | "fair" | "overpriced" | "insufficient-data";
  confidence: "low" | "medium" | "high";
  comparableProperties: PropertyPriceComparable[];
  rationale: string[];
  warnings: string[];
  generatedAt: string;
}

export type PropertyPriceRecommendationFeedbackDecision = "accepted" | "rejected" | "adjusted";

export interface SubmitPropertyPriceRecommendationFeedbackRequest {
  engine: PropertyPriceRecommendation["engine"];
  modelVersion: string;
  recommendationGeneratedAt?: string;
  suggestedPrice: Money;
  decision: PropertyPriceRecommendationFeedbackDecision;
  selectedPrice?: Money;
  note?: string;
}

export interface PropertyPriceRecommendationFeedbackSnapshot {
  id: string;
  tenantId: string;
  propertyId: string;
  engine: PropertyPriceRecommendation["engine"];
  modelVersion: string;
  recommendationGeneratedAt?: string;
  suggestedPrice: Money;
  decision: PropertyPriceRecommendationFeedbackDecision;
  selectedPrice?: Money;
  note?: string;
  createdByUserId?: string;
  createdByUserRole?: UserRole;
  createdAt: string;
}

export interface PricingTrainingDatasetRow {
  feedbackId: string;
  propertyId: string;
  engine: PropertyPriceRecommendation["engine"];
  modelVersion: string;
  decision: PropertyPriceRecommendationFeedbackDecision;
  features: {
    market: ThailandMarket;
    kind: PropertyKind;
    status: PropertySnapshot["status"];
    bedrooms: number;
    bathrooms: number;
    areaSqm: number;
    floor?: number;
    beachDistanceMeters?: number;
    amenities: string[];
    currentPrice: Money;
    currentPricePerSqm: Money;
    suggestedPrice: Money;
  };
  label: {
    accepted: boolean;
    selectedPrice?: Money;
    selectedPricePerSqm?: Money;
  };
  createdAt: string;
}

export interface PricingTrainingDatasetResponse {
  items: PricingTrainingDatasetRow[];
  total: number;
  generatedAt: string;
}

export interface PricingModelRegistryEntry {
  engine: PropertyPriceRecommendation["engine"];
  modelVersion: string;
  predictionTarget: PropertyPriceRecommendation["predictionTarget"];
  trainingStatus: PropertyPriceRecommendation["trainingStatus"];
  featuresUsed: string[];
  active: boolean;
  description: string;
  trainedAt?: string;
  metrics?: {
    mae?: Money;
    mape?: number;
    r2?: number;
    sampleSize?: number;
  };
}

export interface PricingModelRegistryResponse {
  activeModelVersion: string;
  models: PricingModelRegistryEntry[];
  generatedAt: string;
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

export type LeadSource = "website" | "public-api" | "agent" | "ai-chat" | "ai-concierge";

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

export interface TenantSecurityDashboardMetrics {
  rejectedJobEnqueues: number;
  blockedAiActions: number;
  imageDeletePreviews: number;
  imageRemovals: number;
  rejectedJobsByName: CountByBucket[];
  blockedAiActionsByName: CountByBucket[];
}

export type TenantSecurityEventKind =
  | "rejected-job-enqueue"
  | "blocked-ai-action"
  | "image-delete-previewed"
  | "image-removed";

export type TenantSecurityEventSeverity = "info" | "warning" | "critical";
export type TenantSecurityEventAcknowledgementFilter = "all" | "acknowledged" | "unacknowledged";

export interface TenantSecurityEventSnapshot {
  id: string;
  auditEventId: string;
  tenantId: string;
  kind: TenantSecurityEventKind;
  severity: TenantSecurityEventSeverity;
  action: AuditAction;
  userId?: string;
  userRole?: UserRole;
  resourceType: AuditEventSnapshot["resourceType"];
  resourceId?: string;
  message: string;
  metadata: Record<string, unknown>;
  acknowledgedAt?: string;
  acknowledgedByUserId?: string;
  acknowledgedByUserRole?: UserRole;
  acknowledgementNote?: string;
  createdAt: string;
}

export interface TenantSecurityEventsResponse {
  items: TenantSecurityEventSnapshot[];
  total: number;
  limit: number;
  filters: TenantSecurityEventsRequest;
  summary: TenantSecurityEventsSummary;
}

export interface TenantSecurityEventsRequest {
  kind?: TenantSecurityEventKind;
  severity?: TenantSecurityEventSeverity;
  userId?: string;
  acknowledgement?: TenantSecurityEventAcknowledgementFilter;
  limit?: number;
}

export interface TenantSecurityEventsSummary {
  total: number;
  bySeverity: CountByBucket[];
  byKind: CountByBucket[];
  byAcknowledgement: CountByBucket[];
}

export interface AcknowledgeSecurityEventRequest {
  note?: string;
}

export interface AcknowledgeSecurityEventResponse {
  event: TenantSecurityEventSnapshot;
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
  conciergeSessions: number;
  conciergeAwaitingInputSessions: number;
  conciergeRecommendedSessions: number;
  conciergeLeads: number;
  conciergeLeadConversionRate: number;
  conciergeFeedbackCount: number;
  conciergePositiveFeedbackRate: number;
  conciergeTrainingDatasetRows: number;
  conciergeTrainingLabelCoverageRate: number;
  conciergeRecommendationsByArea: CountByBucket[];
  conciergeFeedbackByRating: CountByBucket[];
  security: TenantSecurityDashboardMetrics;
  generatedAt: string;
}

export type RealtimeEventType =
  | "property.created"
  | "property.amenities_updated"
  | "property.images_updated"
  | "property.published"
  | "property.price_updated"
  | "property.status_changed"
  | "lead.created"
  | "lead.assigned"
  | "security.event_detected"
  | "security.event_acknowledged";

export interface RealtimeEvent<TPayload = Record<string, unknown>> {
  type: RealtimeEventType;
  tenantId: string;
  payload: TPayload;
  occurredAt: string;
}

export const PROPERTYFLOW_JOBS_QUEUE = "propertyflow.jobs";

export type BackgroundJobName =
  | "knowledge.chunks.embed"
  | "knowledge.documents.ingest"
  | "concierge.model.train"
  | "pricing.model.train"
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

export interface KnowledgeDocumentIngestJobPayload extends BackgroundJobBasePayload {
  documentId: string;
  reason: "created" | "updated" | "manual";
}

export interface KnowledgeChunkEmbeddingJobPayload extends BackgroundJobBasePayload {
  documentId?: string;
  provider: "local-hash" | "openai" | "anthropic" | "gemini";
  model: string;
  dimensions: number;
  limit?: number;
}

export interface PropertyAiDescriptionJobPayload extends BackgroundJobBasePayload {
  propertyId: string;
  locales: Array<"en" | "ru" | "th" | "zh">;
}

export interface PropertyImageAnalysisJobPayload extends BackgroundJobBasePayload {
  propertyId: string;
  imageUrls: string[];
  imageIds?: string[];
}

export interface PropertySearchIndexJobPayload extends BackgroundJobBasePayload {
  propertyId: string;
  reason: "created" | "updated" | "manual";
}

export interface PricingModelTrainJobPayload extends BackgroundJobBasePayload {
  modelVersion: string;
  algorithm: "baseline-refresh" | "catboost" | "lightgbm";
  dryRun?: boolean;
}

export interface ConciergeModelTrainJobPayload extends BackgroundJobBasePayload {
  modelVersion: string;
  algorithm: "baseline-refresh" | "llm-reranker" | "learning-to-rank";
  dryRun?: boolean;
}

export type BackgroundJobPayload =
  | ConciergeModelTrainJobPayload
  | KnowledgeChunkEmbeddingJobPayload
  | KnowledgeDocumentIngestJobPayload
  | PricingModelTrainJobPayload
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
