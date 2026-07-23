import { describe, expect, it } from "vitest";
import { buildCustomDomainOriginSuggestion, normalizeWidgetOrigin, normalizeWidgetOrigins } from "./widget-origins";

describe("widget origins model", () => {
  it("normalizes origins from full URLs", () => {
    expect(normalizeWidgetOrigin(" HTTPS://Agency.Example.com/listings/42?utm=demo ")).toBe("https://agency.example.com");
  });

  it("deduplicates invalid and repeated origins", () => {
    expect(
      normalizeWidgetOrigins([
        "https://agency.example.com",
        "https://agency.example.com/contact",
        "not a url",
        "HTTPS://AGENCY.EXAMPLE.COM/listing"
      ])
    ).toEqual(["https://agency.example.com"]);
  });

  it("builds an origin suggestion from custom domain", () => {
    expect(buildCustomDomainOriginSuggestion("demo.propertyflow.local")).toBe("https://demo.propertyflow.local");
    expect(buildCustomDomainOriginSuggestion()).toBeUndefined();
  });
});
