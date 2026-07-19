import { describe, expect, it } from "vitest";
import type { KnowledgeDocumentSnapshot } from "@propertyflow/contracts";
import { buildKnowledgeStarterReadiness } from "./knowledge-starter-readiness";

describe("buildKnowledgeStarterReadiness", () => {
  it("matches starter requirements from title, tags, and kind", () => {
    const readiness = buildKnowledgeStarterReadiness([
      documentFactory({ kind: "faq", title: "Client questions and answers" }),
      documentFactory({ kind: "legal", tags: ["visa", "retirement"], title: "Thailand relocation rules" }),
      documentFactory({ kind: "investment", tags: ["tax"], title: "Transfer cost assumptions" }),
      documentFactory({ kind: "article", tags: ["company"], title: "About our Pattaya agency" })
    ]);

    expect(readiness.completed).toBe(4);
    expect(readiness.missing).toBe(5);
    expect(readiness.items.find((item) => item.id === "faq")?.done).toBe(true);
    expect(readiness.items.find((item) => item.id === "visa-guide")?.done).toBe(true);
    expect(readiness.items.find((item) => item.id === "tax-information")?.done).toBe(true);
    expect(readiness.items.find((item) => item.id === "company-information")?.done).toBe(true);
  });

  it("keeps uncovered starter documents visible", () => {
    const readiness = buildKnowledgeStarterReadiness([]);

    expect(readiness.completed).toBe(0);
    expect(readiness.total).toBe(9);
    expect(readiness.items.every((item) => !item.done)).toBe(true);
  });
});

function documentFactory(overrides: Partial<KnowledgeDocumentSnapshot>): KnowledgeDocumentSnapshot {
  return {
    body: "Demo body",
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
