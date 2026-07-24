import { describe, expect, it } from "vitest";
import type { KnowledgeDocumentSnapshot } from "@propertyflow/contracts";
import { buildKnowledgeStarterReadiness } from "./knowledge-starter-readiness";

describe("buildKnowledgeStarterReadiness", () => {
  it("matches starter requirements from title, tags, and kind", () => {
    const readiness = buildKnowledgeStarterReadiness([
      documentFactory({ kind: "faq", tags: ["faq", "source-url"], title: "Client questions and answers" }),
      documentFactory({ kind: "legal", tags: ["visa", "retirement", "source-url"], title: "Thailand relocation rules" }),
      documentFactory({ kind: "investment", tags: ["tax", "source-url"], title: "Transfer cost assumptions" }),
      documentFactory({ kind: "article", tags: ["company", "source-url"], title: "About our Pattaya agency" })
    ]);

    expect(readiness.completed).toBe(4);
    expect(readiness.launchReady).toBe(true);
    expect(readiness.missing).toBe(5);
    expect(readiness.nextAction).toBe("Install the widget and test a real buyer question.");
    expect(readiness.nextActions).toEqual([
      {
        href: "#knowledge-chat",
        id: "test-ai-answer",
        label: "Test AI answer",
        priority: "high",
        reason: "Ask a buyer question before copying the widget."
      },
      {
        href: "#retrieval-preview",
        id: "check-retrieval",
        label: "Check retrieval",
        priority: "medium",
        reason: "Confirm Concierge cites the expected private sources."
      }
    ]);
    expect(readiness.phase).toBe("launch-ready");
    expect(readiness.summary).toBe("Core documents are ready for Starter Concierge answers.");
    expect(readiness.items.find((item) => item.id === "faq")?.done).toBe(true);
    expect(readiness.items.find((item) => item.id === "visa-guide")?.done).toBe(true);
    expect(readiness.items.find((item) => item.id === "tax-information")?.done).toBe(true);
    expect(readiness.items.find((item) => item.id === "company-information")?.done).toBe(true);
    expect(readiness.items.find((item) => item.id === "faq")?.readyDocuments).toBe(1);
  });

  it("keeps uncovered starter documents visible", () => {
    const readiness = buildKnowledgeStarterReadiness([]);

    expect(readiness.completed).toBe(0);
    expect(readiness.launchReady).toBe(false);
    expect(readiness.nextAction).toBe("Upload an FAQ or company information document first.");
    expect(readiness.nextActions.map((action) => action.id)).toEqual(["add-faq", "add-company-information", "add-buying-guide"]);
    expect(readiness.nextActions[0]).toMatchObject({
      href: "?create=source#create-knowledge-document",
      label: "Add FAQ",
      priority: "high",
      reason: "FAQ is the minimum Starter source for first answers."
    });
    expect(readiness.phase).toBe("empty");
    expect(readiness.total).toBe(9);
    expect(readiness.items.every((item) => !item.done)).toBe(true);
  });

  it("does not mark low-quality matching documents as done", () => {
    const readiness = buildKnowledgeStarterReadiness([documentFactory({ body: "Short FAQ", kind: "faq", tags: ["faq"], title: "FAQ" })]);
    const faq = readiness.items.find((item) => item.id === "faq");

    expect(faq).toMatchObject({
      done: false,
      matchedDocuments: 1,
      readyDocuments: 0
    });
    expect(readiness.completed).toBe(0);
    expect(readiness.nextAction).toBe("Add an AI-ready FAQ before installing the widget.");
    expect(readiness.nextActions[0]).toMatchObject({
      id: "add-faq",
      reason: "1 draft source needs stronger AI readiness."
    });
    expect(readiness.phase).toBe("review");
  });

  it("keeps launch blocked while knowledge jobs are still indexing", () => {
    const readiness = buildKnowledgeStarterReadiness(
      [
        documentFactory({ kind: "faq", tags: ["faq", "source-url"], title: "Client FAQ" }),
        documentFactory({ kind: "article", tags: ["company", "source-url"], title: "Company information" }),
        documentFactory({ kind: "article", tags: ["buying", "source-url"], title: "Buying guide" })
      ],
      2
    );

    expect(readiness.launchReady).toBe(false);
    expect(readiness.nextAction).toBe("Wait for indexing to finish, then run an AI answer check.");
    expect(readiness.nextActions).toEqual([
      {
        href: "#knowledge-jobs",
        id: "watch-indexing",
        label: "Watch indexing",
        priority: "high",
        reason: "Wait until workers finish before testing answers."
      }
    ]);
    expect(readiness.phase).toBe("indexing");
  });
});

function documentFactory(overrides: Partial<KnowledgeDocumentSnapshot>): KnowledgeDocumentSnapshot {
  return {
    body: `${"Demo source body with enough context for retrieval and concierge answers. ".repeat(4)}\n\nSource reference:\n- Source URL: https://agency.example.com/source`,
    createdAt: "2026-07-19T00:00:00.000Z",
    id: overrides.id ?? crypto.randomUUID(),
    kind: "article",
    locale: "en",
    tags: [],
    tenantId: "demo-agency",
    title: "Demo document",
    updatedAt: "2026-07-19T00:00:00.000Z",
    ...overrides
  };
}
