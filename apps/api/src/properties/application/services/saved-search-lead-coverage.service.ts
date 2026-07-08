import { Inject, Injectable } from "@nestjs/common";
import type {
  LeadSnapshot,
  LeadStatus,
  ListSavedSearchLeadCoverageRequest,
  RequestUser,
  SavedSearchLeadCoverageResponse
} from "@propertyflow/contracts";
import { LeadService } from "../../../leads/application/lead.service.js";
import { SavedPropertySearchService } from "./saved-property-search.service.js";

@Injectable()
export class SavedSearchLeadCoverageService {
  constructor(
    @Inject(SavedPropertySearchService) private readonly savedSearches: SavedPropertySearchService,
    @Inject(LeadService) private readonly leads: LeadService
  ) {}

  async getCoverage(
    tenantId: string,
    searchId: string,
    user: RequestUser,
    request: ListSavedSearchLeadCoverageRequest = {}
  ): Promise<SavedSearchLeadCoverageResponse> {
    const limit = Math.min(Math.max(request.limit ?? 100, 1), 100);
    const onlyUncovered = request.onlyUncovered ?? false;
    const sort = request.sort ?? "search-rank";
    const matches = await this.savedSearches.getMatches(tenantId, searchId, user);
    const leads = await this.leads.listByAttribution(tenantId, matches.savedSearch.id);
    const leadsByProperty = new Map<string, LeadSnapshot[]>();

    for (const lead of leads.items) {
      if (!lead.propertyId) {
        continue;
      }

      leadsByProperty.set(lead.propertyId, [...(leadsByProperty.get(lead.propertyId) ?? []), lead]);
    }

    const items = matches.items.map((property) => {
      const propertyLeads = leadsByProperty.get(property.id) ?? [];
      const latestLead = [...propertyLeads].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

      return {
        property,
        hasLead: propertyLeads.length > 0,
        leadCount: propertyLeads.length,
        latestLeadId: latestLead?.id,
        latestLeadAt: latestLead?.createdAt,
        leadsByStatus: this.summarizeLeadStatuses(propertyLeads)
      };
    });
    const coveredMatches = items.filter((item) => item.hasLead).length;
    const totalMatches = items.length;
    const filteredMatches = this.sortItems(items, sort).filter((item) => !onlyUncovered || !item.hasLead);
    const filteredItems = filteredMatches.slice(0, limit);

    return {
      savedSearch: matches.savedSearch,
      items: filteredItems,
      returnedItems: filteredItems.length,
      filteredMatches: filteredMatches.length,
      hasMore: filteredMatches.length > filteredItems.length,
      totalMatches,
      coveredMatches,
      uncoveredMatches: totalMatches - coveredMatches,
      coverageRate: totalMatches ? Math.round((coveredMatches / totalMatches) * 10_000) / 100 : 0,
      generatedAt: new Date().toISOString()
    };
  }

  private summarizeLeadStatuses(leads: LeadSnapshot[]): { status: LeadStatus; count: number }[] {
    const statuses: LeadStatus[] = ["new", "contacted", "qualified", "lost", "won"];

    return statuses.map((status) => ({
      status,
      count: leads.filter((lead) => lead.status === status).length
    }));
  }

  private sortItems(
    items: SavedSearchLeadCoverageResponse["items"],
    sort: NonNullable<ListSavedSearchLeadCoverageRequest["sort"]>
  ): SavedSearchLeadCoverageResponse["items"] {
    if (sort === "search-rank") {
      return items;
    }

    return [...items].sort((left, right) => {
      if (sort === "uncovered-first") {
        return Number(left.hasLead) - Number(right.hasLead);
      }

      return (right.latestLeadAt ?? "").localeCompare(left.latestLeadAt ?? "");
    });
  }
}
