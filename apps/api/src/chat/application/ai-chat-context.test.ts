import { describe, expect, it } from "vitest";
import type { KnowledgeDocumentChunkSnapshot } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import {
  buildAiChatContext,
  buildConversationContext,
  buildListingEvidence,
  describeProperty,
  knowledgeCitation,
  knowledgeLine,
  propertyCitation,
  shortPropertyLine
} from "./ai-chat-context.js";

describe("ai-chat-context", () => {
  it("builds authoritative listing evidence without numbered recommendation prose", () => {
    const evidence = buildListingEvidence([propertyFactory()]);

    expect(evidence.join("\n")).toContain("Structured listing evidence");
    expect(evidence.join("\n")).toContain("id=property-1");
    expect(evidence.join("\n")).toContain("project=The Riviera Wongamat");
    expect(evidence.join("\n")).toContain("amenities=sea-view, pool, fast-internet");
  });

  it("keeps prior recommended listing ids in conversation context", () => {
    const context = buildConversationContext({
      conversation: [
        {
          recommendedListings: [
            { propertyId: "property-1", title: "Price Comparable A" },
            { propertyId: "property-2", title: "Pricing Metadata Smoke Condo" }
          ],
          role: "assistant",
          text: "I found two options."
        }
      ],
      locale: "en",
      message: "May I see the first one?"
    });

    expect(context).toContain("Recommended listings shown:");
    expect(context).toContain("1. Price Comparable A (property-1)");
    expect(context).toContain("2. Pricing Metadata Smoke Condo (property-2)");
  });

  it("formats citations and concise property lines", () => {
    const property = propertyFactory();
    const chunk = knowledgeChunkFactory();

    expect(propertyCitation(property)).toMatchObject({
      label: "Wongamat Sea View Residence, pattaya, 3500000 THB",
      propertyId: "property-1",
      source: "property"
    });
    expect(knowledgeCitation(chunk)).toMatchObject({
      documentId: "document-1",
      label: "Buying Guide (legal, chunk 1, score 0.91)",
      source: "knowledge"
    });
    expect(knowledgeLine(chunk)).toContain("Buying Guide: Foreign ownership process");
    expect(describeProperty(property)).toContain("Wongamat Sea View Residence is a 1-bedroom condo");
    expect(shortPropertyLine(property)).toContain("estimated rent 28000 THB/mo");
  });

  it("adds citation labels to the final generation context", () => {
    const context = buildAiChatContext("Answer draft", [propertyCitation(propertyFactory())]);

    expect(context).toContain("Answer draft");
    expect(context).toContain("Source labels available through the separate citations API field:");
    expect(context).toContain("- Wongamat Sea View Residence, pattaya, 3500000 THB");
  });
});

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
    monthlyRentEstimate: {
      amount: 28_000,
      currency: "THB"
    },
    price: {
      amount: 3_500_000,
      currency: "THB"
    },
    project: {
      amenities: ["pool", "gym", "security"],
      createdAt: "2026-07-21T00:00:00.000Z",
      developer: "Riviera Group",
      id: "project-1",
      market: "pattaya",
      name: "The Riviera Wongamat",
      status: "completed",
      tenantId: "tenant-1",
      updatedAt: "2026-07-21T00:00:00.000Z"
    },
    status: "available",
    tenantId: "tenant-1",
    title: "Wongamat Sea View Residence",
    updatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides
  };
}

function knowledgeChunkFactory(overrides: Partial<KnowledgeDocumentChunkSnapshot> = {}): KnowledgeDocumentChunkSnapshot {
  return {
    chunkIndex: 0,
    content: "Foreign ownership process and transfer fee guidance for Thailand condo buyers.",
    createdAt: "2026-07-21T00:00:00.000Z",
    documentId: "document-1",
    embeddingStatus: "embedded",
    id: "chunk-1",
    kind: "legal",
    locale: "en",
    score: 0.91,
    tags: [],
    tenantId: "tenant-1",
    title: "Buying Guide",
    tokenEstimate: 42,
    updatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides
  };
}
