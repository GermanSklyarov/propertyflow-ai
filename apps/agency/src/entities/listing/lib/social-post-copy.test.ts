import { describe, expect, it } from "vitest";
import { buildPublicLeadCaptureUrl, composeSocialPostText } from "./social-post-copy";

describe("composeSocialPostText", () => {
  it("builds a copy-ready social post with spacing", () => {
    expect(
      composeSocialPostText({
        body: "Body",
        cta: "CTA",
        hashtags: ["#PattayaProperty", "#ThailandRealEstate"],
        hook: "Hook",
        leadCaptureUrl: "http://localhost:3000/properties/property-1?utm_source=facebook#lead-capture"
      })
    ).toBe("Hook\n\nBody\n\nCTA\n\nhttp://localhost:3000/properties/property-1?utm_source=facebook#lead-capture\n\n#PattayaProperty #ThailandRealEstate");
  });

  it("skips empty sections", () => {
    expect(composeSocialPostText({ body: "Body", cta: "", hashtags: [], hook: "Hook" })).toBe("Hook\n\nBody");
  });

  it("builds an absolute lead capture URL from the public web base", () => {
    expect(buildPublicLeadCaptureUrl("/properties/property-1#lead-capture", "https://agency.example/")).toBe(
      "https://agency.example/properties/property-1#lead-capture"
    );
  });
});
