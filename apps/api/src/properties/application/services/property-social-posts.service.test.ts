import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PropertySnapshot } from "@propertyflow/domain";
import type { PropertyRepository } from "../../domain/property.repository.js";
import { PropertySocialPostsService } from "./property-social-posts.service.js";

const listing = {
  address: "Wongamat Beach, Pattaya",
  amenities: ["pool", "sea view", "fiber internet"],
  areaSqm: 45,
  bathrooms: 1,
  bedrooms: 1,
  coverImage: {
    id: "image-1",
    imageUrl: "https://example.com/cover.jpg"
  },
  createdAt: "2026-07-14T00:00:00.000Z",
  description: "High-floor condo near Wongamat beach with sea view and strong winter rental appeal.",
  id: "property-1",
  kind: "condo",
  listingType: "sale_or_rent",
  location: { latitude: 12.9, longitude: 100.88 },
  market: "pattaya",
  price: { amount: 3_500_000, currency: "THB" },
  project: {
    amenities: ["gym"],
    createdAt: "2026-07-14T00:00:00.000Z",
    developer: "Riviera Group",
    id: "project-1",
    market: "pattaya",
    name: "The Riviera Wongamat",
    status: "completed",
    tenantId: "demo-agency",
    updatedAt: "2026-07-14T00:00:00.000Z"
  },
  rentalPriceMonthly: { amount: 28_000, currency: "THB" },
  status: "available",
  tenantId: "demo-agency",
  title: "Wongamat Sea View Residence",
  updatedAt: "2026-07-14T00:00:00.000Z"
} satisfies PropertySnapshot;

describe("PropertySocialPostsService", () => {
  it("generates channel-specific social post drafts from a tenant listing", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(listing)
    } as unknown as PropertyRepository;
    const service = new PropertySocialPostsService(repository);

    const response = await service.generateDrafts("demo-agency", "property-1", {
      channels: ["line-voom", "instagram"],
      publicPhotoCount: 4
    });

    expect(response.propertyId).toBe("property-1");
    expect(response.drafts).toHaveLength(2);
    expect(response.drafts[0]).toMatchObject({
      channel: "line-voom",
      label: "LINE VOOM",
      status: "ready"
    });
    expect(response.drafts[0].body).toContain("The Riviera Wongamat");
    expect(response.drafts[0].hashtags).toContain("#PattayaProperty");
    expect(repository.findById).toHaveBeenCalledWith("demo-agency", "property-1");
  });

  it("marks drafts for review when publication facts are missing", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue({ ...listing, coverImage: undefined, description: undefined })
    } as unknown as PropertyRepository;
    const service = new PropertySocialPostsService(repository);

    const response = await service.generateDrafts("demo-agency", "property-1");

    expect(response.drafts.every((draft) => draft.status === "review")).toBe(true);
    expect(response.drafts[0].body).toContain("45 sqm");
  });

  it("uses locale-specific copy when a locale is requested", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue({ ...listing, description: undefined })
    } as unknown as PropertyRepository;
    const service = new PropertySocialPostsService(repository);

    const response = await service.generateDrafts("demo-agency", "property-1", {
      channels: ["facebook"],
      locale: "ru",
      publicPhotoCount: 2
    });

    expect(response.locale).toBe("ru");
    expect(response.drafts[0].body).toContain("вариант для продажи или аренды");
    expect(response.drafts[0].body).toContain("45 кв.м");
    expect(response.drafts[0].cta).toContain("Facebook");
  });

  it("throws when the listing is not visible to the tenant", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(null)
    } as unknown as PropertyRepository;
    const service = new PropertySocialPostsService(repository);

    await expect(service.generateDrafts("demo-agency", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
