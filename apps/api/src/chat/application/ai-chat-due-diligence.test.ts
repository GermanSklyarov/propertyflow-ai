import { describe, expect, it, vi } from "vitest";
import type { AiAdvisorSummary } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { buildAiChatDueDiligencePayload, buildPropertyInsights } from "./ai-chat-due-diligence.js";

describe("ai-chat-due-diligence", () => {
  it("builds context lines and bounded insights from advisor summaries", async () => {
    const advisor = {
      summarize: vi.fn().mockResolvedValue(summaryFactory())
    };

    const payload = await buildAiChatDueDiligencePayload("tenant-1", [propertyFactory()], advisor);

    expect(advisor.summarize).toHaveBeenCalledWith("tenant-1", "property-1");
    expect(payload.contextLines.join("\n")).toContain("Structured due diligence context");
    expect(payload.contextLines.join("\n")).toContain("watch-outs: Low floor may reduce view appeal.");
    expect(payload.contextLines.join("\n")).toContain("data gaps/risks: Missing maintenance fee makes ownership cost incomplete.");
    expect(payload.contextLines.join("\n")).toContain("verification questions: What is the exact foreign quota status?");
    expect(payload.insights).toEqual([
      {
        detail: "Best suited for living, investment based on current listing signals.",
        kind: "fit",
        propertyId: "property-1",
        severity: "info",
        title: "Wongamat Sea View Residence fit"
      },
      {
        detail: "Missing maintenance fee makes ownership cost incomplete.",
        kind: "risk",
        propertyId: "property-1",
        severity: "warning",
        title: "Wongamat Sea View Residence risk check"
      },
      {
        detail: "Estimated gross yield is below target.",
        kind: "risk",
        propertyId: "property-1",
        severity: "warning",
        title: "Wongamat Sea View Residence risk check"
      },
      {
        detail: "What is the exact foreign quota status?",
        kind: "due_diligence",
        propertyId: "property-1",
        severity: "info",
        title: "Ask before recommending"
      },
      {
        detail: "Are short-term rentals allowed?",
        kind: "due_diligence",
        propertyId: "property-1",
        severity: "info",
        title: "Ask before recommending"
      }
    ]);
  });

  it("returns an empty payload when there are no properties", async () => {
    const advisor = {
      summarize: vi.fn()
    };

    await expect(buildAiChatDueDiligencePayload("tenant-1", [], advisor)).resolves.toEqual({
      contextLines: [],
      insights: []
    });
    expect(advisor.summarize).not.toHaveBeenCalled();
  });

  it("uses a neutral context line when a summary has no watch-outs", async () => {
    const advisor = {
      summarize: vi.fn().mockResolvedValue(
        summaryFactory({
          cons: [],
          questionsToAskAgent: [],
          risks: []
        })
      )
    };

    const payload = await buildAiChatDueDiligencePayload("tenant-1", [propertyFactory()], advisor);

    expect(payload.contextLines.join("\n")).toContain(
      "Wongamat Sea View Residence: no material watch-outs were detected from structured fields."
    );
    expect(payload.insights).toEqual([
      {
        detail: "Best suited for living, investment based on current listing signals.",
        kind: "fit",
        propertyId: "property-1",
        severity: "info",
        title: "Wongamat Sea View Residence fit"
      }
    ]);
  });

  it("limits risks and questions to avoid noisy chat insight payloads", () => {
    const insights = buildPropertyInsights(
      propertyFactory(),
      summaryFactory({
        questionsToAskAgent: ["Question 1", "Question 2", "Question 3"],
        risks: ["Risk 1", "Risk 2", "Risk 3"]
      })
    );

    expect(insights.filter((insight) => insight.kind === "risk")).toHaveLength(2);
    expect(insights.filter((insight) => insight.kind === "due_diligence")).toHaveLength(2);
    expect(insights).not.toContainEqual(expect.objectContaining({ detail: "Risk 3" }));
    expect(insights).not.toContainEqual(expect.objectContaining({ detail: "Question 3" }));
  });
});

function summaryFactory(overrides: Partial<AiAdvisorSummary> = {}): AiAdvisorSummary {
  return {
    bestFor: ["living", "investment"],
    confidence: "medium",
    cons: ["Low floor may reduce view appeal."],
    generatedFrom: ["property-price", "property-location"],
    propertyId: "property-1",
    pros: ["Sea view can support stronger resale and rental positioning."],
    questionsToAskAgent: ["What is the exact foreign quota status?", "Are short-term rentals allowed?"],
    risks: ["Missing maintenance fee makes ownership cost incomplete.", "Estimated gross yield is below target."],
    ...overrides
  };
}

function propertyFactory(overrides: Partial<PropertySnapshot> = {}): PropertySnapshot {
  return {
    amenities: ["sea-view", "pool", "fast-internet"],
    areaSqm: 45,
    bathrooms: 1,
    beachDistanceMeters: 240,
    bedrooms: 1,
    createdAt: "2026-07-21T00:00:00.000Z",
    id: "property-1",
    kind: "condo",
    listingType: "sale",
    location: {
      latitude: 12.95,
      longitude: 100.88
    },
    market: "pattaya",
    price: {
      amount: 3_500_000,
      currency: "THB"
    },
    status: "available",
    tenantId: "tenant-1",
    title: "Wongamat Sea View Residence",
    updatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides
  };
}
