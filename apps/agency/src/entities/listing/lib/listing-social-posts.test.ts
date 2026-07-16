import { describe, expect, it } from "vitest";
import type { PropertySnapshot } from "@propertyflow/domain";
import { buildListingSocialPostDrafts } from "./listing-social-posts";

const listing = {
  address: "Wongamat Beach, Pattaya",
  amenities: ["pool", "sea view", "fiber internet"],
  areaSqm: 45,
  bathrooms: 1,
  bedrooms: 1,
  createdAt: "2026-07-14T00:00:00.000Z",
  description: "High-floor condo near Wongamat beach with sea view and strong winter rental appeal.",
  id: "listing-1",
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

describe("listing social post drafts", () => {
  it("creates channel-specific drafts from listing facts", () => {
    const drafts = buildListingSocialPostDrafts(listing, { publicPhotoCount: 4 });

    expect(drafts).toHaveLength(3);
    expect(drafts.map((draft) => draft.channel)).toEqual(["line-voom", "facebook", "instagram"]);
    expect(drafts[0].body).toContain("The Riviera Wongamat");
    expect(drafts[0].body).toContain("THB");
    expect(drafts[0].hashtags).toContain("#PattayaProperty");
    expect(drafts.every((draft) => draft.status === "ready")).toBe(true);
  });

  it("marks drafts for review when publication assets are missing", () => {
    const drafts = buildListingSocialPostDrafts({ ...listing, description: undefined }, { publicPhotoCount: 0 });

    expect(drafts.every((draft) => draft.status === "review")).toBe(true);
    expect(drafts[0].body).toContain("45 sqm");
  });
});
