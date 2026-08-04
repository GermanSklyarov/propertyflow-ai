import { describe, expect, it } from "vitest";
import {
  defaultWidgetListingUrlTemplate,
  isWidgetListingUrlTemplate,
  normalizeWidgetListingUrlTemplate
} from "./widget-listing-links";

describe("widget listing links model", () => {
  it("keeps relative listing routes with a property id placeholder", () => {
    expect(normalizeWidgetListingUrlTemplate(" /catalog/:propertyId?from=concierge ")).toBe(
      "/catalog/:propertyId?from=concierge"
    );
    expect(normalizeWidgetListingUrlTemplate("/:propertyId")).toBe("/:propertyId");
  });

  it("rejects absolute, protocol-relative, and non-placeholder routes", () => {
    expect(normalizeWidgetListingUrlTemplate("https://agency.example.com/listings/:propertyId")).toBeUndefined();
    expect(normalizeWidgetListingUrlTemplate("//agency.example.com/listings/:propertyId")).toBeUndefined();
    expect(normalizeWidgetListingUrlTemplate("/listings")).toBeUndefined();
  });

  it("exposes a stable default route for new widget installs", () => {
    expect(defaultWidgetListingUrlTemplate).toBe("/listings/:propertyId");
    expect(isWidgetListingUrlTemplate(defaultWidgetListingUrlTemplate)).toBe(true);
  });
});
