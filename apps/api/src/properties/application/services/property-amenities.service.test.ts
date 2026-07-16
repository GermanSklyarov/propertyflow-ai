import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PropertySnapshot } from "@propertyflow/domain";
import { PropertyAmenitiesService, normalizeAmenities } from "./property-amenities.service.js";
import type { PropertyRepository } from "../../domain/property.repository.js";

describe("PropertyAmenitiesService", () => {
  it("normalizes and deduplicates amenity labels before saving", async () => {
    const property = { id: "property-1", amenities: ["Pool", "Wi-Fi"] } as PropertySnapshot;
    const repository = {
      updateAmenities: vi.fn().mockResolvedValue(property)
    } as unknown as PropertyRepository;
    const service = new PropertyAmenitiesService(repository);

    await expect(
      service.update("tenant-1", "property-1", {
        amenities: ["Pool", " swimming pool ", "Wi-Fi", "wifi", "", "Gym"]
      })
    ).resolves.toBe(property);
    expect(repository.updateAmenities).toHaveBeenCalledWith("tenant-1", "property-1", ["Pool", "Wi-Fi", "Gym"]);
  });

  it("throws when the property does not exist", async () => {
    const repository = {
      updateAmenities: vi.fn().mockResolvedValue(null)
    } as unknown as PropertyRepository;
    const service = new PropertyAmenitiesService(repository);

    await expect(service.update("tenant-1", "missing", { amenities: ["pool"] })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("normalizeAmenities", () => {
  it("keeps the first agent-facing label for each normalized amenity", () => {
    expect(normalizeAmenities(["Swimming Pool", "pool", "Air-con", "air conditioning"])).toEqual([
      "Swimming Pool",
      "Air-con"
    ]);
  });
});
