import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { SavePropertySocialPostDraftRequest } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import type { PropertyImagesRepository } from "../../domain/property-images.repository.js";
import type { PropertyRepository } from "../../domain/property.repository.js";
import type { PropertySocialPostDraftOverridesRepository } from "../../domain/property-social-post-draft-overrides.repository.js";
import type { PropertySocialPostPublicationsRepository } from "../../domain/property-social-post-publications.repository.js";
import type { PropertySocialPostReviewsRepository } from "../../domain/property-social-post-reviews.repository.js";
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

const gallery = [
  {
    createdAt: "2026-07-14T00:00:00.000Z",
    id: "image-1",
    imageUrl: "https://example.com/cover.jpg",
    position: 0,
    propertyId: "property-1",
    tenantId: "demo-agency"
  },
  {
    caption: "Living room",
    createdAt: "2026-07-14T00:00:00.000Z",
    id: "image-2",
    imageUrl: "https://example.com/living.jpg",
    position: 1,
    propertyId: "property-1",
    tenantId: "demo-agency"
  },
  {
    createdAt: "2026-07-14T00:00:00.000Z",
    id: "image-3",
    imageUrl: "https://example.com/bathroom.jpg",
    position: 2,
    propertyId: "property-1",
    tenantId: "demo-agency"
  }
];

const user = {
  id: "manager-demo-1",
  role: "manager",
  tenantId: "demo-agency"
} as const;

function createService(property: PropertySnapshot | null = listing, images = gallery) {
  const repository = {
    findById: vi.fn().mockResolvedValue(property)
  } as unknown as PropertyRepository;
  const imageRepository = {
    listByPropertyId: vi.fn().mockResolvedValue(images)
  } as unknown as PropertyImagesRepository;
  const publicationRepository = {
    listByPropertyId: vi.fn().mockResolvedValue([
      {
        channel: "line-voom",
        createdByUserId: user.id,
        createdByUserRole: user.role,
        id: "publication-1",
        locale: "en",
        propertyId: "property-1",
        publishedAt: "2026-07-17T01:00:00.000Z",
        status: "published",
        tenantId: "demo-agency",
        trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
        utm: {
          campaign: "pattaya-sale-or-rent-property-1",
          content: "line-voom-en",
          medium: "social",
          source: "line-voom"
        }
      }
    ]),
    record: vi.fn().mockResolvedValue({
      channel: "line-voom",
      createdByUserId: user.id,
      createdByUserRole: user.role,
      id: "publication-1",
      locale: "en",
      propertyId: "property-1",
      publishedAt: "2026-07-17T01:00:00.000Z",
      publishedUrl: "https://linevoom.line.me/post/example",
      status: "published",
      tenantId: "demo-agency",
      trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
      utm: {
        campaign: "pattaya-sale-or-rent-property-1",
        content: "line-voom-en",
        medium: "social",
        source: "line-voom"
      }
    })
  } as unknown as PropertySocialPostPublicationsRepository;
  const draftOverrideRepository = {
    listByPropertyId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue({
      body: "Agent-edited body with a softer relocation angle.",
      channel: "line-voom",
      createdAt: "2026-07-17T00:10:00.000Z",
      createdByUserId: user.id,
      createdByUserRole: user.role,
      cta: "Ask for the newest viewing window.",
      hashtags: ["#PattayaProperty", "#Edited"],
      hook: "Agent-edited LINE VOOM hook",
      id: "draft-override-1",
      locale: "en",
      propertyId: "property-1",
      tenantId: "demo-agency",
      trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
      updatedAt: "2026-07-17T00:15:00.000Z",
      updatedByUserId: user.id,
      updatedByUserRole: user.role
    })
  } as unknown as PropertySocialPostDraftOverridesRepository;
  const reviewRepository = {
    listByPropertyId: vi.fn().mockResolvedValue([
      {
        channel: "line-voom",
        createdAt: "2026-07-17T00:30:00.000Z",
        createdByUserId: user.id,
        createdByUserRole: user.role,
        id: "review-1",
        locale: "en",
        propertyId: "property-1",
        status: "approved",
        tenantId: "demo-agency",
        trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
        updatedAt: "2026-07-17T00:45:00.000Z",
        updatedByUserId: user.id,
        updatedByUserRole: user.role
      }
    ]),
    record: vi.fn().mockResolvedValue({
      channel: "line-voom",
      createdAt: "2026-07-17T00:30:00.000Z",
      createdByUserId: user.id,
      createdByUserRole: user.role,
      id: "review-1",
      locale: "en",
      note: "Approved for LINE VOOM.",
      propertyId: "property-1",
      status: "approved",
      tenantId: "demo-agency",
      trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
      updatedAt: "2026-07-17T00:45:00.000Z",
      updatedByUserId: user.id,
      updatedByUserRole: user.role
    })
  } as unknown as PropertySocialPostReviewsRepository;

  return {
    imageRepository,
    draftOverrideRepository,
    publicationRepository,
    repository,
    reviewRepository,
    service: new PropertySocialPostsService(repository, imageRepository, draftOverrideRepository, publicationRepository, reviewRepository)
  };
}

describe("PropertySocialPostsService", () => {
  it("generates channel-specific social post drafts from a tenant listing", async () => {
    const { imageRepository, repository, service } = createService();

    const response = await service.generateDrafts("demo-agency", "property-1", {
      channels: ["line-voom", "instagram"],
      publicPhotoCount: 3
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
    expect(response.drafts[0].mediaPlan.items).toHaveLength(3);
    expect(response.drafts[0].mediaPlan.items[0]).toMatchObject({ imageId: "image-1", role: "cover" });
    expect(response.drafts[0].publicationPlan).toEqual({
      leadCapturePath:
        "/properties/property-1?pf_source=social-post&pf_tracking=pattaya-sale-or-rent-property-1-line-voom-en&utm_campaign=pattaya-sale-or-rent-property-1&utm_content=line-voom-en&utm_medium=social&utm_source=line-voom#lead-capture",
      nextAction: "Publish to LINE VOOM and use the tracking slug for reply attribution.",
      trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
      utm: {
        campaign: "pattaya-sale-or-rent-property-1",
        content: "line-voom-en",
        medium: "social",
        source: "line-voom"
      }
    });
    expect(response.drafts[0].approvalWorkflow).toEqual({
      allowedActions: ["request-review", "approve"],
      currentStage: "draft",
      reviewNote: "Ready for agent review and manager approval.",
      stages: [
        { key: "draft", label: "Draft", state: "current" },
        { key: "review", label: "Review", state: "pending" },
        { key: "approved", label: "Approved", state: "pending" },
        { key: "published", label: "Published", state: "pending" }
      ]
    });
    expect(response.drafts[0].readiness).toEqual([
      { key: "copy", label: "Listing copy available", ready: true },
      { key: "media", label: "3 photos selected", ready: true },
      { key: "hashtags", label: "4 hashtags ready", ready: true }
    ]);
    expect(repository.findById).toHaveBeenCalledWith("demo-agency", "property-1");
    expect(imageRepository.listByPropertyId).toHaveBeenCalledWith("demo-agency", "property-1");
  });

  it("applies saved social post draft overrides during generation", async () => {
    const { draftOverrideRepository, service } = createService();
    vi.mocked(draftOverrideRepository.listByPropertyId).mockResolvedValueOnce([
      {
        body: "Edited body saved by the agent.",
        channel: "line-voom",
        createdAt: "2026-07-17T00:10:00.000Z",
        createdByUserId: user.id,
        createdByUserRole: user.role,
        cta: "Edited CTA.",
        hashtags: ["#Edited", "#PattayaProperty"],
        hook: "Edited hook",
        id: "draft-override-1",
        locale: "en",
        propertyId: "property-1",
        tenantId: "demo-agency",
        trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
        updatedAt: "2026-07-17T00:15:00.000Z",
        updatedByUserId: user.id,
        updatedByUserRole: user.role
      }
    ]);

    const response = await service.generateDrafts("demo-agency", "property-1", {
      channels: ["line-voom", "instagram"]
    });

    expect(response.drafts[0]).toMatchObject({
      body: "Edited body saved by the agent.",
      cta: "Edited CTA.",
      hashtags: ["#Edited", "#PattayaProperty"],
      hook: "Edited hook"
    });
    expect(response.drafts[1].hook).not.toBe("Edited hook");
    expect(draftOverrideRepository.listByPropertyId).toHaveBeenCalledWith("demo-agency", "property-1");
  });

  it("marks drafts for review when publication facts are missing", async () => {
    const { service } = createService({ ...listing, coverImage: undefined, description: undefined }, []);

    const response = await service.generateDrafts("demo-agency", "property-1");

    expect(response.drafts.every((draft) => draft.status === "review")).toBe(true);
    expect(response.drafts[0].body).toContain("45 sqm");
    expect(response.drafts[0].mediaPlan.warnings).toContain("Add public gallery photos before publishing this post.");
    expect(response.drafts[0].readiness).toContainEqual({ key: "copy", label: "Description missing", ready: false });
    expect(response.drafts[0].readiness).toContainEqual({ key: "media", label: "Gallery photos missing", ready: false });
    expect(response.drafts[0].approvalWorkflow.allowedActions).toEqual([]);
    expect(response.drafts[0].approvalWorkflow.currentStage).toBe("review");
    expect(response.drafts[0].approvalWorkflow.reviewNote).toBe("Resolve copy, media before approval.");
  });

  it("uses locale-specific copy when a locale is requested", async () => {
    const { service } = createService({ ...listing, description: undefined });

    const response = await service.generateDrafts("demo-agency", "property-1", {
      channels: ["facebook"],
      locale: "ru",
      publicPhotoCount: 2
    });

    expect(response.locale).toBe("ru");
    expect(response.drafts[0].body).toContain("вариант для продажи или аренды");
    expect(response.drafts[0].body).toContain("45 кв.м");
    expect(response.drafts[0].cta).toContain("Facebook");
    expect(response.drafts[0].publicationPlan.utm.content).toBe("facebook-ru");
  });

  it("throws when the listing is not visible to the tenant", async () => {
    const { service } = createService(null);

    await expect(service.generateDrafts("demo-agency", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("records a social post publication for lead attribution", async () => {
    const { publicationRepository, repository, service } = createService();
    const request = {
      channel: "line-voom",
      locale: "en",
      publishedUrl: "https://linevoom.line.me/post/example",
      trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
      utm: {
        campaign: "pattaya-sale-or-rent-property-1",
        content: "line-voom-en",
        medium: "social",
        source: "line-voom"
      }
    } as const;

    const response = await service.recordPublication("demo-agency", "property-1", request, user);

    expect(response.publication).toEqual({
      channel: "line-voom",
      createdByUserId: "manager-demo-1",
      createdByUserRole: "manager",
      id: "publication-1",
      locale: "en",
      propertyId: "property-1",
      publishedAt: "2026-07-17T01:00:00.000Z",
      publishedUrl: "https://linevoom.line.me/post/example",
      status: "published",
      tenantId: "demo-agency",
      trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
      utm: {
        campaign: "pattaya-sale-or-rent-property-1",
        content: "line-voom-en",
        medium: "social",
        source: "line-voom"
      }
    });
    expect(repository.findById).toHaveBeenCalledWith("demo-agency", "property-1");
    expect(publicationRepository.record).toHaveBeenCalledWith("demo-agency", "property-1", request, user);
  });

  it("saves an edited social post draft for a visible listing", async () => {
    const { draftOverrideRepository, repository, service } = createService();
    const request: SavePropertySocialPostDraftRequest = {
      body: " Agent-edited body with a softer relocation angle. ",
      channel: "line-voom",
      cta: " Ask for the newest viewing window. ",
      hashtags: ["PattayaProperty", "#Edited", "Edited", ""],
      hook: " Agent-edited LINE VOOM hook ",
      locale: "en",
      trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en"
    };

    const response = await service.saveDraft("demo-agency", "property-1", request, user);

    expect(response.draft).toMatchObject({
      body: "Agent-edited body with a softer relocation angle.",
      hook: "Agent-edited LINE VOOM hook",
      trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en"
    });
    expect(repository.findById).toHaveBeenCalledWith("demo-agency", "property-1");
    expect(draftOverrideRepository.save).toHaveBeenCalledWith(
      "demo-agency",
      "property-1",
      {
        ...request,
        body: "Agent-edited body with a softer relocation angle.",
        cta: "Ask for the newest viewing window.",
        hashtags: ["#PattayaProperty", "#Edited"],
        hook: "Agent-edited LINE VOOM hook"
      },
      user
    );
  });

  it("does not save social post draft overrides for a hidden listing", async () => {
    const { service } = createService(null);

    await expect(
      service.saveDraft("demo-agency", "missing", {
        body: "Edited body",
        channel: "facebook",
        cta: "Edited CTA",
        hashtags: ["#Edited"],
        hook: "Edited hook",
        locale: "en",
        trackingSlug: "missing-facebook-en"
      }, user)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("does not record social publication for a hidden listing", async () => {
    const { service } = createService(null);

    await expect(
      service.recordPublication("demo-agency", "missing", {
        channel: "facebook",
        locale: "en",
        trackingSlug: "missing-facebook-en",
        utm: {
          campaign: "missing",
          content: "facebook-en",
          medium: "social",
          source: "facebook"
        }
      }, user)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lists social post publications for a visible listing", async () => {
    const { publicationRepository, service } = createService();

    const response = await service.listPublications("demo-agency", "property-1");

    expect(response).toEqual({
      items: [
        {
          channel: "line-voom",
          createdByUserId: "manager-demo-1",
          createdByUserRole: "manager",
          id: "publication-1",
          locale: "en",
          propertyId: "property-1",
          publishedAt: "2026-07-17T01:00:00.000Z",
          status: "published",
          tenantId: "demo-agency",
          trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
          utm: {
            campaign: "pattaya-sale-or-rent-property-1",
            content: "line-voom-en",
            medium: "social",
            source: "line-voom"
          }
        }
      ],
      propertyId: "property-1",
      total: 1
    });
    expect(publicationRepository.listByPropertyId).toHaveBeenCalledWith("demo-agency", "property-1");
  });

  it("does not list social publications for a hidden listing", async () => {
    const { service } = createService(null);

    await expect(service.listPublications("demo-agency", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("records a social post review status for a visible listing", async () => {
    const { repository, reviewRepository, service } = createService();
    const request = {
      channel: "line-voom",
      locale: "en",
      note: "Approved for LINE VOOM.",
      status: "approved",
      trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en"
    } as const;

    const response = await service.recordReview("demo-agency", "property-1", request, user);

    expect(response.review).toEqual({
      channel: "line-voom",
      createdAt: "2026-07-17T00:30:00.000Z",
      createdByUserId: "manager-demo-1",
      createdByUserRole: "manager",
      id: "review-1",
      locale: "en",
      note: "Approved for LINE VOOM.",
      propertyId: "property-1",
      status: "approved",
      tenantId: "demo-agency",
      trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
      updatedAt: "2026-07-17T00:45:00.000Z",
      updatedByUserId: "manager-demo-1",
      updatedByUserRole: "manager"
    });
    expect(repository.findById).toHaveBeenCalledWith("demo-agency", "property-1");
    expect(reviewRepository.record).toHaveBeenCalledWith("demo-agency", "property-1", request, user);
  });

  it("lists social post review statuses for a visible listing", async () => {
    const { reviewRepository, service } = createService();

    const response = await service.listReviews("demo-agency", "property-1");

    expect(response.total).toBe(1);
    expect(response.items[0]).toMatchObject({
      channel: "line-voom",
      status: "approved",
      trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en"
    });
    expect(reviewRepository.listByPropertyId).toHaveBeenCalledWith("demo-agency", "property-1");
  });

  it("does not record social post reviews for a hidden listing", async () => {
    const { service } = createService(null);

    await expect(
      service.recordReview("demo-agency", "missing", {
        channel: "facebook",
        locale: "en",
        status: "review_requested",
        trackingSlug: "missing-facebook-en"
      }, user)
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
