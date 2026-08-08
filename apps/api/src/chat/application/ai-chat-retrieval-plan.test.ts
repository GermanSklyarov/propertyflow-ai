import { describe, expect, it } from "vitest";
import { planAiChatRetrieval } from "./ai-chat-retrieval-plan.js";

describe("planAiChatRetrieval", () => {
  it("uses explicit property ids before any search planning", () => {
    expect(
      planAiChatRetrieval({
        locale: "en",
        message: "Tell me more about this condo",
        propertyId: "property-1"
      })
    ).toMatchObject({
      mode: "property-detail",
      propertyId: "property-1",
      reason: "explicit-property"
    });
  });

  it("resolves viewing follow-ups from prior recommended listings", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "First Condo" },
              { propertyId: "property-2", title: "Second Condo" }
            ],
            role: "assistant",
            text: "I found two options."
          }
        ],
        locale: "en",
        message: "Can I book the second option?"
      })
    ).toMatchObject({
      mode: "property-detail",
      propertyId: "property-2",
      reason: "follow-up-reference"
    });
  });

  it("resolves named listings from prior recommendations even without ordinal wording", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Chat Smoke Fallback Condo" },
              { propertyId: "property-2", title: "Chat Smoke Beach Condo" }
            ],
            role: "assistant",
            text: "I found two options."
          }
        ],
        locale: "en",
        message: "I want Chat Smoke Fallback Condo"
      })
    ).toMatchObject({
      mode: "property-detail",
      propertyId: "property-1",
      reason: "follow-up-reference"
    });
  });

  it("uses the latest property-detail recommendation for later see-it requests", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Chat Smoke Fallback Condo" },
              { propertyId: "property-2", title: "Chat Smoke Beach Condo" }
            ],
            role: "assistant",
            text: "I found two options."
          },
          {
            role: "user",
            text: "I want Chat Smoke Fallback Condo"
          },
          {
            recommendedListings: [{ propertyId: "property-1", title: "Chat Smoke Fallback Condo" }],
            role: "assistant",
            text: "Certainly, this is the first condo."
          }
        ],
        locale: "en",
        message: "Can I see it next week?"
      })
    ).toMatchObject({
      mode: "property-detail",
      propertyId: "property-1",
      reason: "follow-up-reference"
    });
  });

  it("asks for clarification instead of running a new search when a follow-up has no referenced listing", () => {
    expect(
      planAiChatRetrieval({
        locale: "en",
        message: "May I see it?"
      })
    ).toMatchObject({
      mode: "clarify-reference",
      reason: "missing-follow-up-reference"
    });
  });

  it("recognizes Thai shortlist beach-distance comparisons", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Option A" },
              { propertyId: "property-2", title: "Option B" }
            ],
            role: "assistant",
            text: "I found two options."
          }
        ],
        locale: "th",
        message: "ตัวเลือกไหนใกล้ชายหาดที่สุด"
      })
    ).toMatchObject({
      comparison: "beach-distance",
      mode: "listing-comparison",
      reason: "comparison-follow-up"
    });
  });

  it("recognizes Chinese shortlist beach-distance comparisons", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Option A" },
              { propertyId: "property-2", title: "Option B" }
            ],
            role: "assistant",
            text: "I found two options."
          }
        ],
        locale: "zh",
        message: "这些房源哪个离海滩最近？"
      })
    ).toMatchObject({
      comparison: "beach-distance",
      mode: "listing-comparison",
      reason: "comparison-follow-up"
    });
  });

  it("keeps ordinary listing requests on listing search", () => {
    expect(
      planAiChatRetrieval({
        locale: "en",
        message: "find me a condo in pattaya under 3m"
      })
    ).toMatchObject({
      mode: "listing-search",
      reason: "search-request"
    });
  });
});
