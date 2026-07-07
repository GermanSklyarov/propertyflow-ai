import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateSavedPropertySearchRequest,
  ListSavedSearchOpportunitiesRequest,
  PropertySearchRequest,
  RequestUser,
  SavedSearchAlertAnalyticsResponse,
  SavedSearchAlertRunListResponse,
  SavedSearchAlertRunSnapshot,
  SavedSearchLeadFunnelResponse,
  SavedSearchOpportunitiesResponse,
  SavedPropertySearchAlertsResponse,
  SavedPropertySearchListResponse,
  SavedPropertySearchMatchesResponse,
  SavedPropertySearchRecommendation,
  SavedPropertySearchRecommendationsResponse,
  SavedPropertySearchSnapshot
} from "@propertyflow/contracts";
import type { PropertyPurpose, PropertySnapshot } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";
import {
  SAVED_PROPERTY_SEARCH_REPOSITORY,
  type SavedPropertySearchRepository
} from "../../domain/saved-property-search.repository.js";
import {
  SAVED_SEARCH_ALERT_RUN_REPOSITORY,
  type SavedSearchAlertRunRepository
} from "../../domain/saved-search-alert-run.repository.js";
import { NaturalLanguagePropertySearchService } from "./natural-language-property-search.service.js";

@Injectable()
export class SavedPropertySearchService {
  constructor(
    @Inject(SAVED_PROPERTY_SEARCH_REPOSITORY) private readonly savedSearches: SavedPropertySearchRepository,
    @Inject(SAVED_SEARCH_ALERT_RUN_REPOSITORY) private readonly alertRuns: SavedSearchAlertRunRepository,
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(NaturalLanguagePropertySearchService) private readonly naturalLanguageSearch: NaturalLanguagePropertySearchService
  ) {}

  async create(
    tenantId: string,
    user: RequestUser,
    request: CreateSavedPropertySearchRequest
  ): Promise<SavedPropertySearchSnapshot> {
    const interpretedFilters = request.naturalLanguageQuery
      ? this.naturalLanguageSearch.interpret({
          locale: request.locale ?? "ru",
          query: request.naturalLanguageQuery,
          purpose: request.purpose,
          market: request.filters?.market
        }).filters
      : {};
    const filters = this.normalizeFilters({
      ...interpretedFilters,
      ...(request.filters ?? {})
    });

    if (!Object.keys(filters).length && !request.naturalLanguageQuery) {
      throw new BadRequestException("Saved search requires filters or naturalLanguageQuery");
    }

    const matches = await this.properties.search(tenantId, filters);

    return this.savedSearches.save({
      tenantId,
      userId: user.id,
      title: request.title.trim(),
      naturalLanguageQuery: request.naturalLanguageQuery?.trim(),
      locale: request.naturalLanguageQuery ? request.locale ?? "ru" : request.locale,
      purpose: request.purpose,
      filters,
      matchCount: matches.length,
      notificationsEnabled: request.notificationsEnabled ?? false
    });
  }

  async list(tenantId: string, user: RequestUser): Promise<SavedPropertySearchListResponse> {
    const items = await this.savedSearches.list(tenantId, this.userScope(user));

    return {
      items,
      total: items.length
    };
  }

  async listAlerts(tenantId: string, user: RequestUser): Promise<SavedPropertySearchAlertsResponse> {
    const savedSearches = await this.savedSearches.list(tenantId, this.userScope(user));
    const enabledSearches = savedSearches.filter((search) => search.notificationsEnabled);
    const items = await Promise.all(
      enabledSearches.map(async (savedSearch) => {
        const candidates = await this.properties.search(tenantId, savedSearch.filters);
        const recommendations = candidates
          .map((property) => this.scoreRecommendation(property, savedSearch.filters, savedSearch.purpose))
          .sort((left, right) => right.score - left.score)
          .slice(0, 3);

        return {
          savedSearch,
          currentMatchCount: candidates.length,
          recommendations
        };
      })
    );

    return {
      items,
      total: items.length,
      generatedAt: new Date().toISOString()
    };
  }

  async listAlertRuns(tenantId: string, user: RequestUser, limit?: number): Promise<SavedSearchAlertRunListResponse> {
    const items = await this.alertRuns.list({
      tenantId,
      userId: this.userScope(user),
      limit
    });

    return {
      items,
      total: items.length
    };
  }

  async getAlertAnalytics(tenantId: string, user: RequestUser): Promise<SavedSearchAlertAnalyticsResponse> {
    const userId = this.userScope(user);
    const [savedSearches, recentRuns] = await Promise.all([
      this.savedSearches.list(tenantId, userId),
      this.alertRuns.list({
        tenantId,
        userId,
        limit: 20
      })
    ]);
    const completedRuns = recentRuns.filter((run) => run.status === "completed").length;
    const failedRuns = recentRuns.filter((run) => run.status === "failed").length;
    const totalCandidates = recentRuns.reduce((sum, run) => sum + run.totalCandidates, 0);

    return {
      totalSavedSearches: savedSearches.length,
      enabledAlerts: savedSearches.filter((search) => search.notificationsEnabled).length,
      recentRuns: recentRuns.length,
      completedRuns,
      failedRuns,
      totalCandidates,
      averageCandidatesPerRun: recentRuns.length ? Number((totalCandidates / recentRuns.length).toFixed(2)) : 0,
      lastRun: recentRuns[0],
      generatedAt: new Date().toISOString()
    };
  }

  async getLeadFunnel(tenantId: string, user: RequestUser): Promise<SavedSearchLeadFunnelResponse> {
    const rows = await this.savedSearches.listLeadFunnel(tenantId, this.userScope(user));
    const savedSearchLeads = rows.reduce((sum, row) => sum + row.leadCount, 0);
    const totalSavedSearches = rows.length;

    return {
      totalSavedSearches,
      savedSearchLeads,
      savedSearchLeadConversionRate: totalSavedSearches
        ? Math.round((savedSearchLeads / totalSavedSearches) * 10_000) / 100
        : 0,
      topSavedSearches: rows.slice(0, 10).map((row) => ({
        savedSearch: row.savedSearch,
        leadCount: row.leadCount,
        conversionRate: row.leadCount > 0 ? 100 : 0,
        latestLeadAt: row.latestLeadAt
      })),
      generatedAt: new Date().toISOString()
    };
  }

  async listOpportunities(
    tenantId: string,
    user: RequestUser,
    request: ListSavedSearchOpportunitiesRequest = {}
  ): Promise<SavedSearchOpportunitiesResponse> {
    const limit = Math.min(Math.max(request.limit ?? 10, 1), 50);
    const minScore = Math.min(Math.max(request.minScore ?? 0, 0), 100);
    const includeConverted = request.includeConverted ?? true;
    const funnelRows = await this.savedSearches.listLeadFunnel(tenantId, this.userScope(user));
    const items = await Promise.all(
      funnelRows.map(async (row) => {
        const candidates = await this.properties.search(tenantId, row.savedSearch.filters);
        const topRecommendation = candidates
          .map((property) => this.scoreRecommendation(property, row.savedSearch.filters, row.savedSearch.purpose))
          .sort((left, right) => right.score - left.score)[0];
        const opportunityScore = this.scoreOpportunity(candidates.length, row.leadCount, topRecommendation?.score ?? 0);

        return {
          savedSearch: row.savedSearch,
          currentMatchCount: candidates.length,
          leadCount: row.leadCount,
          opportunityScore,
          reason: this.describeOpportunity(candidates.length, row.leadCount, topRecommendation?.score ?? 0),
          latestLeadAt: row.latestLeadAt,
          topRecommendation
        };
      })
    );

    const rankedItems = items
      .filter((item) => item.currentMatchCount > 0)
      .filter((item) => item.opportunityScore >= minScore)
      .filter((item) => includeConverted || item.leadCount === 0)
      .sort((left, right) => right.opportunityScore - left.opportunityScore)
      .slice(0, limit);

    return {
      items: rankedItems,
      total: rankedItems.length,
      generatedAt: new Date().toISOString()
    };
  }

  async getAlertRunById(tenantId: string, runId: string, user: RequestUser): Promise<SavedSearchAlertRunSnapshot> {
    const run = await this.alertRuns.findById(tenantId, runId);

    if (!run || !this.canAccessAlertRun(user, run)) {
      throw new NotFoundException("Saved search alert run not found");
    }

    return run;
  }

  async getById(tenantId: string, searchId: string, user: RequestUser): Promise<SavedPropertySearchSnapshot> {
    const search = await this.savedSearches.findById(tenantId, searchId);

    if (!search || !this.canAccess(user, search)) {
      throw new NotFoundException("Saved search not found");
    }

    return search;
  }

  async getMatches(
    tenantId: string,
    searchId: string,
    user: RequestUser
  ): Promise<SavedPropertySearchMatchesResponse> {
    const savedSearch = await this.getById(tenantId, searchId, user);
    const items = await this.properties.search(tenantId, savedSearch.filters);

    return {
      savedSearch,
      items,
      total: items.length,
      filters: savedSearch.filters,
      generatedAt: new Date().toISOString()
    };
  }

  async getRecommendations(
    tenantId: string,
    searchId: string,
    user: RequestUser
  ): Promise<SavedPropertySearchRecommendationsResponse> {
    const savedSearch = await this.getById(tenantId, searchId, user);
    const candidates = await this.properties.search(tenantId, savedSearch.filters);
    const recommendations = candidates
      .map((property) => this.scoreRecommendation(property, savedSearch.filters, savedSearch.purpose))
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    return {
      savedSearch,
      recommendations,
      totalCandidates: candidates.length,
      generatedAt: new Date().toISOString()
    };
  }

  async updateNotifications(
    tenantId: string,
    searchId: string,
    user: RequestUser,
    notificationsEnabled: boolean
  ): Promise<SavedPropertySearchSnapshot> {
    const existing = await this.savedSearches.findById(tenantId, searchId);

    if (!existing || !this.canAccess(user, existing)) {
      throw new NotFoundException("Saved search not found");
    }

    const updated = await this.savedSearches.updateNotifications(tenantId, searchId, notificationsEnabled);

    if (!updated) {
      throw new NotFoundException("Saved search not found");
    }

    return updated;
  }

  async delete(tenantId: string, searchId: string, user: RequestUser): Promise<SavedPropertySearchSnapshot> {
    const existing = await this.savedSearches.findById(tenantId, searchId);

    if (!existing || !this.canAccess(user, existing)) {
      throw new NotFoundException("Saved search not found");
    }

    return this.savedSearches.delete(tenantId, searchId) as Promise<SavedPropertySearchSnapshot>;
  }

  private userScope(user: RequestUser): string | undefined {
    return user.role === "agent" ? user.id : undefined;
  }

  private canAccess(user: RequestUser, search: SavedPropertySearchSnapshot): boolean {
    return user.role !== "agent" || search.userId === user.id;
  }

  private canAccessAlertRun(user: RequestUser, run: SavedSearchAlertRunSnapshot): boolean {
    return user.role !== "agent" || run.userId === user.id;
  }

  private normalizeFilters(filters: PropertySearchRequest): PropertySearchRequest {
    return Object.fromEntries(
      Object.entries(filters).filter(([, value]) => {
        if (value === undefined || value === null) {
          return false;
        }

        if (Array.isArray(value)) {
          return value.length > 0;
        }

        return true;
      })
    ) as PropertySearchRequest;
  }

  private scoreRecommendation(
    property: PropertySnapshot,
    filters: PropertySearchRequest,
    purpose?: PropertyPurpose
  ): SavedPropertySearchRecommendation {
    const reasons: string[] = [];
    const tradeoffs: string[] = [];
    let score = 45;

    if (property.status === "available") {
      score += 8;
      reasons.push("Listing is currently available.");
    } else {
      tradeoffs.push(`Listing status is ${property.status}.`);
    }

    if (filters.market && property.market === filters.market) {
      score += 10;
      reasons.push(`Matches the requested ${filters.market} market.`);
    }

    if (filters.maxPriceThb) {
      const budgetRatio = property.price.amount / filters.maxPriceThb;
      if (budgetRatio <= 0.9) {
        score += 10;
        reasons.push("Price leaves room under the requested budget.");
      } else {
        score += 5;
        reasons.push("Price fits the requested budget.");
      }
    }

    if (filters.minBedrooms && property.bedrooms >= filters.minBedrooms) {
      score += 7;
      reasons.push(`Has ${property.bedrooms} bedrooms for the requested layout.`);
    }

    if (filters.minBathrooms && property.bathrooms >= filters.minBathrooms) {
      score += 4;
      reasons.push(`Has ${property.bathrooms} bathrooms.`);
    }

    if (filters.minAreaSqm && property.areaSqm >= filters.minAreaSqm) {
      score += 6;
      reasons.push(`${property.areaSqm} sqm meets the requested minimum area.`);
    }

    if (filters.maxBeachDistanceMeters) {
      if (property.beachDistanceMeters === undefined) {
        tradeoffs.push("Beach distance is not available.");
      } else if (property.beachDistanceMeters <= filters.maxBeachDistanceMeters) {
        score += 8;
        reasons.push("Beach distance matches the requested walking range.");
      }
    }

    const requiredAmenities = filters.requiredAmenities ?? [];
    if (requiredAmenities.length) {
      const propertyAmenities = new Set(property.amenities.map((amenity) => amenity.toLowerCase()));
      const matchedAmenities = requiredAmenities.filter((amenity) => propertyAmenities.has(amenity.toLowerCase()));
      const missingAmenities = requiredAmenities.filter((amenity) => !propertyAmenities.has(amenity.toLowerCase()));

      if (matchedAmenities.length) {
        score += Math.min(10, matchedAmenities.length * 3);
        reasons.push(`Matches amenities: ${matchedAmenities.join(", ")}.`);
      }

      if (missingAmenities.length) {
        tradeoffs.push(`Missing requested amenities: ${missingAmenities.join(", ")}.`);
      }
    }

    score += this.scorePurposeFit(property, purpose, reasons, tradeoffs);

    if (!reasons.length) {
      reasons.push("Matches the saved search filters.");
    }

    return {
      property,
      score: Math.max(0, Math.min(100, score)),
      reasons,
      tradeoffs
    };
  }

  private scoreOpportunity(currentMatchCount: number, leadCount: number, topRecommendationScore: number): number {
    const matchScore = Math.min(35, currentMatchCount * 7);
    const leadGapScore = leadCount === 0 ? 35 : Math.max(0, 20 - leadCount * 5);
    const recommendationScore = Math.round(topRecommendationScore * 0.3);

    return Math.max(0, Math.min(100, matchScore + leadGapScore + recommendationScore));
  }

  private describeOpportunity(currentMatchCount: number, leadCount: number, topRecommendationScore: number): string {
    if (leadCount === 0 && currentMatchCount > 0) {
      return `No saved-search leads yet, with ${currentMatchCount} current matches ready for follow-up.`;
    }

    if (topRecommendationScore >= 80) {
      return `Strong top recommendation and ${currentMatchCount} current matches.`;
    }

    return `${currentMatchCount} current matches and ${leadCount} saved-search leads.`;
  }

  private scorePurposeFit(
    property: PropertySnapshot,
    purpose: PropertyPurpose | undefined,
    reasons: string[],
    tradeoffs: string[]
  ): number {
    if (!purpose) {
      return 0;
    }

    if (purpose === "investment") {
      let score = 0;

      if (property.monthlyRentEstimate) {
        score += 8;
        reasons.push("Has a rental estimate for investment analysis.");
      } else {
        tradeoffs.push("Rental estimate is not available yet.");
      }

      if (property.maintenanceFeeMonthly) {
        score += 4;
        reasons.push("Maintenance fee is available for ownership cost planning.");
      }

      return score;
    }

    if (purpose === "family") {
      const hasFamilyLayout = property.bedrooms >= 2 && property.areaSqm >= 50;

      if (hasFamilyLayout) {
        reasons.push("Layout is more comfortable for a family.");
        return 10;
      }

      tradeoffs.push("Layout may be compact for a family.");
      return 0;
    }

    if (purpose === "relocation") {
      const hasRelocationSignals = property.amenities.some((amenity) =>
        ["coworking", "gym", "parking", "pool"].includes(amenity.toLowerCase())
      );

      if (hasRelocationSignals) {
        reasons.push("Amenities support day-to-day relocation comfort.");
        return 8;
      }

      tradeoffs.push("Relocation lifestyle amenities are limited in the listing data.");
      return 0;
    }

    if (property.beachDistanceMeters !== undefined && property.beachDistanceMeters <= 1000) {
      reasons.push("Good lifestyle fit with beach access nearby.");
      return 8;
    }

    return 0;
  }
}
