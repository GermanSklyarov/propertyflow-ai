import { describe, expect, it } from "vitest";
import type { PropertySocialPostDraft } from "@propertyflow/contracts";
import {
  formatPublicationStatus,
  formatWorkflowAction,
  getInitialPublicationStatus,
  getInitialWorkflowStage,
  getWorkflowStages
} from "./social-post-draft-card";

const workflowStages: PropertySocialPostDraft["approvalWorkflow"]["stages"] = [
  { key: "draft", label: "Draft", state: "current" },
  { key: "review", label: "Review", state: "pending" },
  { key: "approved", label: "Approved", state: "pending" },
  { key: "published", label: "Published", state: "pending" }
];

const draft = {
  approvalWorkflow: {
    allowedActions: ["request-review", "approve"],
    currentStage: "draft",
    reviewNote: "Ready for agent review.",
    stages: workflowStages
  }
} as PropertySocialPostDraft;

describe("social post draft card model", () => {
  it("marks earlier workflow stages complete", () => {
    expect(getWorkflowStages(workflowStages, "approved").map((stage) => stage.state)).toEqual([
      "complete",
      "complete",
      "current",
      "pending"
    ]);
  });

  it("starts published when a publication exists", () => {
    expect(getInitialPublicationStatus(undefined)).toBe("idle");
    expect(getInitialWorkflowStage(draft, undefined)).toBe("draft");

    expect(getInitialPublicationStatus({ id: "publication-id" } as never)).toBe("published");
    expect(getInitialWorkflowStage(draft, { id: "publication-id" } as never)).toBe("published");
  });

  it("formats workflow actions and publication status for compact UI labels", () => {
    expect(formatWorkflowAction("request-review")).toBe("Request Review");
    expect(formatPublicationStatus("error")).toBe("Retry publish");
  });
});
