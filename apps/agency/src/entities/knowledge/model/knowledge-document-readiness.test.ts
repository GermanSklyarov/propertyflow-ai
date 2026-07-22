import { describe, expect, it } from "vitest";
import type { KnowledgeDocumentSnapshot } from "@propertyflow/contracts";
import { assessKnowledgeDocumentReadiness } from "./knowledge-document-readiness";

describe("knowledge document readiness", () => {
  it("marks documents with enough text, tags, and provenance as AI ready", () => {
    const readiness = assessKnowledgeDocumentReadiness(
      knowledgeDocument({
        body: `${"Buying property in Thailand requires transfer planning. ".repeat(5)}\n\nSource reference:\n- Source URL: https://agency.example.com/faq`,
        tags: ["faq", "source-url", "source-domain:agency.example.com"]
      })
    );

    expect(readiness).toMatchObject({
      label: "AI ready",
      score: 3,
      status: "ready"
    });
  });

  it("asks for review when useful retrieval signals are missing", () => {
    const readiness = assessKnowledgeDocumentReadiness(
      knowledgeDocument({
        body: "Short note.",
        tags: ["faq"]
      })
    );

    expect(readiness).toMatchObject({
      missingSignals: ["more source text", "source reference"],
      score: 1,
      status: "review"
    });
  });

  it("blocks empty untagged sources from being treated as reliable", () => {
    const readiness = assessKnowledgeDocumentReadiness(
      knowledgeDocument({
        body: "Tiny",
        tags: []
      })
    );

    expect(readiness).toMatchObject({
      label: "Blocked",
      score: 0,
      status: "blocked"
    });
  });
});

function knowledgeDocument(overrides: Partial<KnowledgeDocumentSnapshot> = {}): KnowledgeDocumentSnapshot {
  return {
    body: "Knowledge body",
    createdAt: "2026-07-22T00:00:00.000Z",
    id: "knowledge-1",
    kind: "faq",
    locale: "en",
    tags: [],
    tenantId: "demo-agency",
    title: "FAQ",
    updatedAt: "2026-07-22T00:00:00.000Z",
    ...overrides
  };
}
