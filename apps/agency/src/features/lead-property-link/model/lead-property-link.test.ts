import { describe, expect, it } from "vitest";
import {
  buildLeadPropertyCandidateHref,
  formatLeadPropertyCandidateSort,
  parseLeadPropertyCandidateRequest
} from "./lead-property-link";

describe("lead property link model", () => {
  it("parses candidate listing filters into a backend search request", () => {
    expect(
      parseLeadPropertyCandidateRequest({
        listingPage: "3",
        listingSearch: " condo jomtien 1 bedroom ",
        listingSort: "rent-asc"
      })
    ).toEqual({
      limit: 6,
      offset: 12,
      query: "condo jomtien 1 bedroom",
      sort: "rent-asc"
    });
  });

  it("builds candidate pagination links without client-side paging state", () => {
    expect(
      buildLeadPropertyCandidateHref(
        "lead-1",
        { limit: 6, offset: 6, query: "buyer phone", sort: "yield-desc" },
        { page: 1 }
      )
    ).toBe("/leads/lead-1?listingSearch=buyer+phone&listingSort=yield-desc#link-listing");
  });

  it("formats candidate sort labels", () => {
    expect(formatLeadPropertyCandidateSort("price-asc")).toBe("Price low to high");
  });
});
