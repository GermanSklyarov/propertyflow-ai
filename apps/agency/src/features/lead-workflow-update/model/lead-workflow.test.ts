import { describe, expect, it } from "vitest";
import { formatLeadFollowUpDateTimeLocalValue, leadWorkflowPriorityOptions, leadWorkflowStatusOptions } from "./lead-workflow";

describe("lead workflow model", () => {
  it("formats ISO timestamps for datetime-local inputs", () => {
    expect(formatLeadFollowUpDateTimeLocalValue("2026-07-17T09:30:00.000Z")).toBe("2026-07-17T09:30");
  });

  it("returns an empty value when no follow-up is scheduled", () => {
    expect(formatLeadFollowUpDateTimeLocalValue()).toBe("");
  });

  it("exposes supported workflow options", () => {
    expect(leadWorkflowStatusOptions).toContain("qualified");
    expect(leadWorkflowPriorityOptions).toEqual(["low", "medium", "high"]);
  });
});
