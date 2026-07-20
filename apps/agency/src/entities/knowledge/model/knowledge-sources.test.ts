import { describe, expect, it } from "vitest";
import type { BackgroundJobMonitorItem, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";
import {
  buildRuntimeKnowledgeSourceGroups,
  knowledgeSourceGroups,
  knowledgeSourcePipeline,
  summarizeKnowledgeSourceModes,
  summarizeKnowledgeSourceReadiness
} from "./knowledge-sources";

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

  it("links ready sources to their operational workflows", () => {
    const documents = knowledgeSourceGroups.find((group) => group.type === "document");
    const propertySources = knowledgeSourceGroups.find((group) => group.type === "property_feed");

    expect(documents?.connectors[0]).toMatchObject({
      actionHref: "#create-knowledge-document",
      actionLabel: "Add document"
    });
    expect(propertySources?.connectors[0]).toMatchObject({
      actionHref: "/listings#import-listings",
      actionLabel: "Open importer"
    });
  });

  it("summarizes source modes for onboarding copy", () => {
    const summary = summarizeKnowledgeSourceModes(knowledgeSourceGroups);

    expect(summary.concierge_index_only).toBeGreaterThan(summary.hybrid);
    expect(summary.hybrid).toBe(1);
    expect(summary.crm_inventory).toBe(0);
  });

  it("summarizes source readiness for the source hub", () => {
    const groups = buildRuntimeKnowledgeSourceGroups(knowledgeSourceGroups, {
      documents: [knowledgeDocument({ tags: ["faq"] }), knowledgeDocument({ id: "knowledge-2", tags: ["property-listing", "source:csv"] })],
      jobs: [],
      totalDocuments: 2
    });
    const summary = summarizeKnowledgeSourceReadiness(groups);

    expect(summary.total).toBe(12);
    expect(summary.connected).toBe(4);
    expect(summary.ready).toBe(0);
    expect(summary.planned).toBe(8);
    expect(summary.actionable).toBe(4);
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

  it("marks document sources as connected when tenant documents exist", () => {
    const groups = buildRuntimeKnowledgeSourceGroups(knowledgeSourceGroups, {
      documents: [knowledgeDocument({ tags: ["faq"] })],
      jobs: [],
      totalDocuments: 1
    });
    const documents = groups.find((group) => group.type === "document");

    expect(documents?.connectors[0]).toMatchObject({
      countLabel: "1 docs",
      runtimeNote: "Available to AI Concierge",
      status: "connected"
    });
  });

  it("surfaces property imports as listing knowledge sources", () => {
    const groups = buildRuntimeKnowledgeSourceGroups(knowledgeSourceGroups, {
      documents: [knowledgeDocument({ tags: ["property-listing", "source:csv"] })],
      jobs: [backgroundJob({ result: { knowledgeDocumentsCreated: 3 } })],
      totalDocuments: 1
    });
    const propertyFeed = groups.find((group) => group.type === "property_feed");

    expect(propertyFeed?.connectors[0]).toMatchObject({
      countLabel: "1 listing docs",
      runtimeNote: "Feeds Concierge without forcing CRM",
      status: "connected"
    });
  });
});

function knowledgeDocument(overrides: Partial<KnowledgeDocumentSnapshot> = {}): KnowledgeDocumentSnapshot {
  return {
    body: "Knowledge body",
    createdAt: "2026-07-20T00:00:00.000Z",
    id: "knowledge-1",
    kind: "faq",
    locale: "en",
    tags: [],
    tenantId: "demo-agency",
    title: "FAQ",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides
  };
}

function backgroundJob(overrides: Partial<BackgroundJobMonitorItem> = {}): BackgroundJobMonitorItem {
  return {
    attemptsMade: 1,
    id: "job-1",
    name: "properties.import",
    payload: {
      importMode: "concierge_index_only",
      objectUrl: "data:text/csv,title",
      requestedByUserId: "manager-demo-1",
      source: "csv",
      tenantId: "demo-agency"
    },
    progress: 100,
    queue: "propertyflow.jobs",
    state: "completed",
    tenantId: "demo-agency",
    ...overrides
  };
}
