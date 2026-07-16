import { describe, expect, it } from "vitest";
import { composeSocialPostText } from "./social-post-copy";

describe("composeSocialPostText", () => {
  it("builds a copy-ready social post with spacing", () => {
    expect(
      composeSocialPostText({
        body: "Body",
        cta: "CTA",
        hashtags: ["#PattayaProperty", "#ThailandRealEstate"],
        hook: "Hook"
      })
    ).toBe("Hook\n\nBody\n\nCTA\n\n#PattayaProperty #ThailandRealEstate");
  });

  it("skips empty sections", () => {
    expect(composeSocialPostText({ body: "Body", cta: "", hashtags: [], hook: "Hook" })).toBe("Hook\n\nBody");
  });
});
