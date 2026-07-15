import { describe, expect, it, vi } from "vitest";
import type { AmenitySuggestionResponse } from "@propertyflow/contracts";
import { AmenitySuggestionsService } from "./amenity-suggestions.service.js";
import type { PropertyRepository } from "../../domain/property.repository.js";

describe("AmenitySuggestionsService", () => {
  it("delegates amenity lookup to the property repository for the current tenant", async () => {
    const response: AmenitySuggestionResponse = {
      filters: { limit: 5, query: "pool" },
      items: [
        {
          count: 3,
          label: "Pool",
          normalized: "swimming pool",
          sources: ["listing", "project"]
        }
      ],
      total: 1
    };
    const repository = {
      searchAmenities: vi.fn().mockResolvedValue(response)
    } as unknown as PropertyRepository;
    const service = new AmenitySuggestionsService(repository);

    await expect(service.search("demo-agency", { limit: 5, query: "pool" })).resolves.toBe(response);
    expect(repository.searchAmenities).toHaveBeenCalledWith("demo-agency", { limit: 5, query: "pool" });
  });
});
