import { describe, expect, it } from "vitest";
import {
  LISTING_API_CUSTOM_ATTRIBUTE_RULES,
  LISTING_API_CONTRACT_SECTIONS,
  LISTING_API_EXAMPLE_PAYLOAD,
  LISTING_API_SETUP_STEPS,
  countListingApiContractFields
} from "./listing-api-contract";

describe("listing API contract", () => {
  it("keeps required, recommended, and custom attribute sections", () => {
    expect(LISTING_API_CONTRACT_SECTIONS.map((section) => section.title)).toEqual([
      "Required search contract",
      "Recommended listing context",
      "Preserved custom attributes"
    ]);
  });

  it("counts mapped feed signals for the setup guide", () => {
    expect(countListingApiContractFields()).toBe(18);
  });

  it("includes availability fields that prevent bad long-rental recommendations", () => {
    expect(LISTING_API_EXAMPLE_PAYLOAD).toContain('"rent_available_until": "2027-03-31"');
    expect(LISTING_API_EXAMPLE_PAYLOAD).toContain('"minimum_rental_months": 12');
  });

  it("documents a self-serve REST feed setup path", () => {
    expect(LISTING_API_SETUP_STEPS.map((step) => step.title)).toEqual([
      "Expose feed",
      "Secure access",
      "Map canonical fields",
      "Preserve extras"
    ]);
    expect(LISTING_API_SETUP_STEPS[1]?.description).toContain("backend secret reference");
  });

  it("keeps custom attribute guidance for availability and agency-specific constraints", () => {
    expect(LISTING_API_CUSTOM_ATTRIBUTE_RULES.map((rule) => rule.title)).toEqual([
      "Availability rules",
      "Deal constraints",
      "Local signals"
    ]);
    expect(LISTING_API_CUSTOM_ATTRIBUTE_RULES[0]?.example).toContain("availability");
  });
});
