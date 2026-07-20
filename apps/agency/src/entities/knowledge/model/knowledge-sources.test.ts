import { describe, expect, it } from "vitest";
import { knowledgeSourceGroups, knowledgeSourcePipeline, summarizeKnowledgeSourceModes } from "./knowledge-sources";

describe("knowledge sources model", () => {
  it("keeps property feeds as AI sources without requiring CRM adoption", () => {
    const propertySources = knowledgeSourceGroups.find((group) => group.type === "property_feed");

    expect(propertySources?.connectors).toContainEqual(
      expect.objectContaining({
        label: "REST API inventory sync",
        mode: "concierge_index_only"
      })
    );
    expect(propertySources?.connectors).toContainEqual(
      expect.objectContaining({
        label: "CSV upload with field mapping",
        mode: "hybrid",
        status: "ready"
      })
    );
  });

  it("summarizes source modes for onboarding copy", () => {
    const summary = summarizeKnowledgeSourceModes(knowledgeSourceGroups);

    expect(summary.concierge_index_only).toBeGreaterThan(summary.hybrid);
    expect(summary.hybrid).toBe(1);
    expect(summary.crm_inventory).toBe(0);
  });

  it("documents the unified ingestion pipeline", () => {
    expect(knowledgeSourcePipeline.map((step) => step.label)).toEqual([
      "Source",
      "Ingestion",
      "Parsing",
      "Embeddings",
      "AI Concierge"
    ]);
  });
});
