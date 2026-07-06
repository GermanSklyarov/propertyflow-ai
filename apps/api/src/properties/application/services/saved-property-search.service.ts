import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateSavedPropertySearchRequest,
  PropertySearchRequest,
  RequestUser,
  SavedPropertySearchListResponse,
  SavedPropertySearchMatchesResponse,
  SavedPropertySearchSnapshot
} from "@propertyflow/contracts";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";
import {
  SAVED_PROPERTY_SEARCH_REPOSITORY,
  type SavedPropertySearchRepository
} from "../../domain/saved-property-search.repository.js";
import { NaturalLanguagePropertySearchService } from "./natural-language-property-search.service.js";

@Injectable()
export class SavedPropertySearchService {
  constructor(
    @Inject(SAVED_PROPERTY_SEARCH_REPOSITORY) private readonly savedSearches: SavedPropertySearchRepository,
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
}
