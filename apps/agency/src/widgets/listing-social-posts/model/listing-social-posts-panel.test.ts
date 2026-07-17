import { describe, expect, it } from "vitest";
import type {
  PropertySocialPostDraft,
  PropertySocialPostPublication,
  PropertySocialPostReview
} from "@propertyflow/contracts";
import {
  findDraftPublication,
  findDraftReview,
  formatSocialPostChannel,
  shortenSocialPostTrackingSlug
} from "./listing-social-posts-panel";

const draft = {
  channel: "line-voom",
  locale: "en",
  publicationPlan: {
    trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en"
  }
} as PropertySocialPostDraft;

describe("listing social posts panel model", () => {
  it("matches publications and reviews by draft identity", () => {
    const publication = {
      channel: "line-voom",
      locale: "en",
      trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en"
    } as PropertySocialPostPublication;
    const review = {
      channel: "line-voom",
      locale: "en",
      trackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en"
    } as PropertySocialPostReview;

    expect(findDraftPublication(draft, [publication])).toBe(publication);
    expect(findDraftReview(draft, [review])).toBe(review);
  });

  it("formats compact publication history labels", () => {
    expect(formatSocialPostChannel("line-voom")).toBe("LINE VOOM");
    expect(formatSocialPostChannel("facebook")).toBe("Facebook");
    expect(shortenSocialPostTrackingSlug("short-slug")).toBe("short-slug");
    expect(shortenSocialPostTrackingSlug("pattaya-sale-or-rent-property-1-line-voom-en")).toBe("pattaya-sale-or...line-voom-en");
  });
});
