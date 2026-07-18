import { describe, expect, it } from "vitest";
import { buildActiveLeadFilterLabel, buildLeadQueueHref, formatLeadSort, parseLeadQueueRequest } from "./lead-filters";

describe("lead filters model", () => {
  it("parses supported lead queue filters", () => {
    expect(
      parseLeadQueueRequest({
        page: "3",
        missingProperty: "true",
        priority: "high",
        query: "+66 81",
        source: "ai-concierge",
        sort: "priority-desc",
        status: "new",
        unassigned: "true"
      })
    ).toMatchObject({
      limit: 12,
      missingProperty: true,
      offset: 24,
      priority: "high",
      query: "+66 81",
      source: "ai-concierge",
      sort: "priority-desc",
      status: "new",
      unassigned: true
    });
  });

  it("drops unsupported filter values", () => {
    expect(parseLeadQueueRequest({ priority: "urgent", source: "newsletter", status: "archived", unassigned: "false" })).toEqual({
      limit: 12,
      missingProperty: undefined,
      offset: 0,
      priority: undefined,
      query: undefined,
      source: undefined,
      sort: "follow-up-asc",
      status: undefined,
      unassigned: undefined
    });
  });

  it("builds stable lead queue hrefs without leaking the API limit", () => {
    expect(buildLeadQueueHref({ limit: 12, missingProperty: true, offset: 12, query: "maya", source: "social-post" }, { priority: "high" })).toBe(
      "/leads?missingProperty=true&query=maya&source=social-post&priority=high"
    );
  });

  it("labels the most specific active filter", () => {
    expect(buildActiveLeadFilterLabel({ limit: 24, priority: "high", unassigned: true })).toBe("Unassigned leads");
    expect(buildActiveLeadFilterLabel({ limit: 24, missingProperty: true })).toBe("Missing property");
  });

  it("formats lead queue sort labels", () => {
    expect(formatLeadSort("priority-desc")).toBe("Priority first");
  });
});
