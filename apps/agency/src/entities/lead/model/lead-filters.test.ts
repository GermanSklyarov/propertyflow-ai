import { describe, expect, it } from "vitest";
import { buildActiveLeadFilterLabel, buildLeadQueueHref, parseLeadQueueRequest } from "./lead-filters";

describe("lead filters model", () => {
  it("parses supported lead queue filters", () => {
    expect(
      parseLeadQueueRequest({
        priority: "high",
        source: "ai-concierge",
        status: "new",
        unassigned: "true"
      })
    ).toMatchObject({
      limit: 24,
      priority: "high",
      source: "ai-concierge",
      status: "new",
      unassigned: true
    });
  });

  it("drops unsupported filter values", () => {
    expect(parseLeadQueueRequest({ priority: "urgent", source: "newsletter", status: "archived", unassigned: "false" })).toEqual({
      limit: 24,
      priority: undefined,
      source: undefined,
      status: undefined,
      unassigned: undefined
    });
  });

  it("builds stable lead queue hrefs without leaking the API limit", () => {
    expect(buildLeadQueueHref({ limit: 24, source: "social-post" }, { priority: "high" })).toBe("/leads?source=social-post&priority=high");
  });

  it("labels the most specific active filter", () => {
    expect(buildActiveLeadFilterLabel({ limit: 24, priority: "high", unassigned: true })).toBe("Unassigned leads");
  });
});
