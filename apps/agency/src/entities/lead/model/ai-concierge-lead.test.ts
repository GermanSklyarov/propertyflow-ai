import { describe, expect, it } from "vitest";
import type { LeadSnapshot } from "@propertyflow/contracts";
import { parseAiConciergeLeadContext } from "./ai-concierge-lead";

describe("parseAiConciergeLeadContext", () => {
  it("extracts visitor note, recommendations, and conversation from widget handoff messages", () => {
    expect(
      parseAiConciergeLeadContext(
        leadFactory({
          message: [
            "Widget handoff request.",
            "",
            "Visitor note: Please use WhatsApp.",
            "",
            "Recommended listings:",
            "1. Wongamat Sea View Residence (property-1)",
            "2. Central Pattaya Rental Loft (property-2)",
            "",
            "Recent widget conversation:",
            "user: I need a condo in Pattaya under 3M",
            "assistant: I found a matching option.",
            "Shown listings:",
            "1. Wongamat Sea View Residence (property-1)",
            "user: I want to view it next month."
          ].join("\n")
        })
      )
    ).toEqual({
      conversation: [
        { role: "user", text: "I need a condo in Pattaya under 3M" },
        { role: "assistant", text: "I found a matching option." },
        { role: "user", text: "I want to view it next month." }
      ],
      recommendedListings: [
        { propertyId: "property-1", title: "Wongamat Sea View Residence" },
        { propertyId: "property-2", title: "Central Pattaya Rental Loft" }
      ],
      visitorNote: "Please use WhatsApp."
    });
  });

  it("returns null for non-concierge leads or unstructured messages", () => {
    expect(parseAiConciergeLeadContext(leadFactory({ source: "website" }))).toBeNull();
    expect(parseAiConciergeLeadContext(leadFactory({ message: "Please call me." }))).toBeNull();
  });
});

function leadFactory(overrides: Partial<LeadSnapshot> = {}): LeadSnapshot {
  return {
    contactName: "Buyer",
    createdAt: "2026-07-21T00:00:00.000Z",
    id: "lead-1",
    priority: "medium",
    source: "ai-concierge",
    status: "new",
    tenantId: "tenant-1",
    updatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides
  };
}
