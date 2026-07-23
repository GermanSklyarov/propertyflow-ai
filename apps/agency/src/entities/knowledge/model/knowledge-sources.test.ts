import { describe, expect, it } from "vitest";
import type { BackgroundJobMonitorItem, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";
import {
  buildKnowledgeSourceGroupAction,
  buildKnowledgeSourceLaunchGate,
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

  it("builds primary source group actions from ready connectors", () => {
    const documents = knowledgeSourceGroups.find((group) => group.type === "document");
    const propertySources = knowledgeSourceGroups.find((group) => group.type === "property_feed");

    expect(documents ? buildKnowledgeSourceGroupAction(documents) : undefined).toEqual({
      href: "#create-knowledge-document",
      label: "Add document"
    });
    expect(propertySources ? buildKnowledgeSourceGroupAction(propertySources) : undefined).toEqual({
      href: "/listings#import-listings",
      label: "Open importer"
    });
  });

  it("does not create a primary action for planned-only source groups", () => {
    const external = knowledgeSourceGroups.find((group) => group.type === "external");

    expect(external ? buildKnowledgeSourceGroupAction(external) : undefined).toBeUndefined();
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
    expect(summary.connected).toBe(3);
    expect(summary.ready).toBe(3);
    expect(summary.planned).toBe(6);
    expect(summary.actionable).toBe(6);
  });

  it("blocks widget launch when no source is connected", () => {
    const summary = summarizeKnowledgeSourceReadiness(knowledgeSourceGroups);

    expect(buildKnowledgeSourceLaunchGate(summary)).toEqual({
      nextAction: "Add at least one document, website page, or listing feed before sharing the widget.",
      status: "blocked",
      summary: "No connected AI sources yet"
    });
  });

  it("marks launch gate as indexing while source workers are active", () => {
    const groups = buildRuntimeKnowledgeSourceGroups(knowledgeSourceGroups, {
      documents: [],
      jobs: [backgroundJob({ name: "knowledge.documents.ingest", state: "active" })],
      totalDocuments: 0
    });
    const summary = summarizeKnowledgeSourceReadiness(groups);

    expect(buildKnowledgeSourceLaunchGate(summary)).toEqual({
      nextAction: "Wait for active ingestion jobs to finish before installing the widget.",
      status: "indexing",
      summary: "5 sources indexing now"
    });
  });

  it("marks launch gate ready once at least one source feeds AI", () => {
    const groups = buildRuntimeKnowledgeSourceGroups(knowledgeSourceGroups, {
      documents: [knowledgeDocument({ tags: ["faq"] })],
      jobs: [],
      totalDocuments: 1
    });
    const summary = summarizeKnowledgeSourceReadiness(groups);

    expect(buildKnowledgeSourceLaunchGate(summary)).toEqual({
      nextAction: "Copy the widget once origins and localized messages are configured.",
      status: "ready",
      summary: "2 connected sources feeding AI"
    });
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
      countLabel: "1/1 ready docs",
      runtimeNote: "Available to AI Concierge",
      status: "connected"
    });
  });

  it("keeps weak matching documents in review instead of marking sources connected", () => {
    const groups = buildRuntimeKnowledgeSourceGroups(knowledgeSourceGroups, {
      documents: [knowledgeDocument({ body: "Tiny FAQ", tags: ["faq"], title: "FAQ" })],
      jobs: [],
      totalDocuments: 1
    });
    const documents = groups.find((group) => group.type === "document");

    expect(documents?.connectors[0]).toMatchObject({
      countLabel: "0/1 ready docs",
      runtimeNote: "Review document readiness before widget launch",
      status: "ready"
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

  it("surfaces pasted website pages as concierge knowledge sources", () => {
    const groups = buildRuntimeKnowledgeSourceGroups(knowledgeSourceGroups, {
      documents: [
        knowledgeDocument({ tags: ["website", "source:website-faq-pages"] }),
        knowledgeDocument({ id: "knowledge-2", tags: ["blog", "source:website-blog-articles"] })
      ],
      jobs: [],
      totalDocuments: 2
    });
    const website = groups.find((group) => group.type === "website");

    expect(website?.connectors[0]).toMatchObject({
      countLabel: "1/1 ready pages",
      runtimeNote: "FAQ pages ready for Concierge",
      status: "connected"
    });
    expect(website?.connectors[1]).toMatchObject({
      countLabel: "1/1 ready pages",
      runtimeNote: "Website articles ready for Concierge",
      status: "connected"
    });
  });
});

function knowledgeDocument(overrides: Partial<KnowledgeDocumentSnapshot> = {}): KnowledgeDocumentSnapshot {
  return {
    body: `${"Knowledge body with enough useful details for retrieval and AI Concierge answers. ".repeat(4)}\n\nSource reference:\n- Source URL: https://agency.example.com/source`,
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
