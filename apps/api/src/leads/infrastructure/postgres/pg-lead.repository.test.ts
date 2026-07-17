import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PgLeadRepository } from "./pg-lead.repository.js";

describe("PgLeadRepository", () => {
  it("filters social post leads by string property id without uuid/text mismatch", async () => {
    const createdAt = new Date("2026-07-17T10:00:00.000Z");
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            assigned_agent_id: null,
            attribution_search_event_id: null,
            attribution_search_query: null,
            attribution_search_source: null,
            attribution_social_post_campaign: "pattaya-sale-or-rent-property-1",
            attribution_social_post_channel: "facebook",
            attribution_social_post_tracking_slug: "pattaya-sale-or-rent-property-1-facebook-en",
            contact_email: "client@example.com",
            contact_name: "Facebook Client",
            contact_phone: null,
            created_at: createdAt,
            id: "lead-1",
            message: null,
            next_follow_up_at: null,
            preferred_locale: "en",
            priority: "medium",
            property_id: "10000000-0000-4000-8000-000000000001",
            source: "social-post",
            status: "new",
            tenant_id: "demo-agency",
            updated_at: createdAt
          }
        ]
      })
    } as unknown as Pool;
    const repository = new PgLeadRepository(pool);

    const leads = await repository.list("demo-agency", {
      attributionSocialPostTrackingSlug: "pattaya-sale-or-rent-property-1-facebook-en",
      limit: 100,
      propertyId: "10000000-0000-4000-8000-000000000001",
      source: "social-post"
    });

    expect(leads[0]).toMatchObject({
      attributionSocialPostTrackingSlug: "pattaya-sale-or-rent-property-1-facebook-en",
      propertyId: "10000000-0000-4000-8000-000000000001",
      source: "social-post"
    });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("property_id::text = $8"),
      [
        "demo-agency",
        null,
        "social-post",
        null,
        false,
        null,
        null,
        "10000000-0000-4000-8000-000000000001",
        "pattaya-sale-or-rent-property-1-facebook-en",
        100
      ]
    );
  });
});
