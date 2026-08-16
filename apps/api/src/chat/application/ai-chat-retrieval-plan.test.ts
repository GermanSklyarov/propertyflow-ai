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

  it("keeps ordinary purchase searches on listing search instead of ownership advice", () => {
    expect(
      planAiChatRetrieval({
        locale: "en",
        message: "i want to buy a house in pattaya"
      })
    ).toMatchObject({
      mode: "listing-search",
      reason: "search-request"
    });
  });

  it("routes general foreign ownership questions to advice instead of listing search", () => {
    expect(
      planAiChatRetrieval({
        locale: "en",
        message: "can a foreigner buy a house in pattaya?"
      })
    ).toMatchObject({
      mode: "general-advice",
      reason: "search-request"
    });
  });

  it("compares recent listings when asking which option works for foreign ownership", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "townhouse", title: "4BR Townhouse at Centric Sea Pattaya" },
              { propertyId: "condo", title: "2BR Condo at Grand Avenue Residence" }
            ],
            role: "assistant",
            text: "I found two options."
          }
        ],
        locale: "en",
        message: "Which of them can a foreigner buy?"
      })
    ).toMatchObject({
      comparison: "ownership",
      mode: "listing-comparison",
      reason: "comparison-follow-up"
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

  it("keeps ordinal viewing slots on the referenced listing", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Pratumnak Investment One-Bed" },
              { propertyId: "property-2", title: "Terminal 21 Walkable Studio" }
            ],
            role: "assistant",
            text: "I found two options."
          }
        ],
        locale: "en",
        message: "i like the second option, can i view it on friday at 3 pm?"
      })
    ).toMatchObject({
      mode: "property-detail",
      propertyId: "property-2",
      reason: "follow-up-reference"
    });
  });

  it("keeps rent availability date follow-ups on the referenced listing", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Siam Oriental Tropical Garden" },
              { propertyId: "property-2", title: "City Garden Pratumnak" }
            ],
            role: "assistant",
            text: "I found two options."
          }
        ],
        locale: "en",
        message: "I like the first option and I want to rent on 1st september it's possible?"
      })
    ).toMatchObject({
      mode: "property-detail",
      propertyId: "property-1",
      reason: "follow-up-reference"
    });
  });

  it("recognizes common viewing date phrases as booking follow-ups", () => {
    const baseConversation = [
      {
        recommendedListings: [
          { propertyId: "property-1", title: "Pratumnak Investment One-Bed" },
          { propertyId: "property-2", title: "Terminal 21 Walkable Studio" }
        ],
        role: "assistant" as const,
        text: "I found two options."
      }
    ];
    const messages = [
      "i like the second option, can i view it on 15 august at 3p.m?",
      "i like the second option, can i view it this weekend?",
      "i like the second option, can i view it tomorrow at 3 p.m?",
      "i would lile to view the second option tomorrow at 1 pm",
      "can i view the second option next week?"
    ];

    for (const message of messages) {
      expect(
        planAiChatRetrieval({
          conversation: baseConversation,
          locale: "en",
          message
        })
      ).toMatchObject({
        mode: "property-detail",
        propertyId: "property-2",
        reason: "follow-up-reference"
      });
    }
  });

  it("keeps later pronoun viewing requests on the previously selected listing", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Pratumnak Investment One-Bed" },
              { propertyId: "property-2", title: "Terminal 21 Walkable Studio" }
            ],
            role: "assistant",
            text: "I found two options."
          },
          { role: "user", text: "can i view the second option next week?" },
          { role: "assistant", text: "Please share your contact so the team can confirm." }
        ],
        locale: "en",
        message: "can i view it?"
      })
    ).toMatchObject({
      mode: "property-detail",
      propertyId: "property-2",
      reason: "follow-up-reference"
    });
  });

  it("asks for clarification when the visitor references an unseen ordinal option", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Terminal 21 Walkable Studio" },
              { propertyId: "property-2", title: "Central Pattaya Rental Loft" }
            ],
            role: "assistant",
            text: "I found two options."
          }
        ],
        locale: "en",
        message: "what about the third option?"
      })
    ).toMatchObject({
      mode: "clarify-reference",
      reason: "missing-follow-up-reference"
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

  it("keeps viewing date follow-ups on the selected listing instead of searching again", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Pratumnak Investment One-Bed" },
              { propertyId: "property-2", title: "Terminal 21 Walkable Studio" }
            ],
            role: "assistant",
            text: "I found two options."
          },
          {
            role: "user",
            text: "i like the first option, may i see it?"
          },
          {
            recommendedListings: [{ propertyId: "property-1", title: "Pratumnak Investment One-Bed" }],
            role: "assistant",
            text: "I can ask the agency to confirm viewing availability."
          }
        ],
        locale: "en",
        message: "i want to view this project on thursday at 3 pm"
      })
    ).toMatchObject({
      mode: "property-detail",
      propertyId: "property-1",
      reason: "follow-up-reference"
    });
  });

  it("routes contextual investment advice questions to the current listing instead of searching again", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [{ propertyId: "property-1", title: "Wongamat Sea View Residence" }],
            role: "assistant",
            text: "Wongamat Sea View Residence is the top match."
          }
        ],
        locale: "en",
        message: "this condo is worth for investment?"
      })
    ).toMatchObject({
      intent: {
        includeAdvice: true,
        route: "property-follow-up"
      },
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

  it("recognizes named city POI distance comparisons for recent options", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Studio Condo at Huai Yai Villas - Huai Yai" },
              { propertyId: "property-2", title: "Studio Condo at Del Mare Bangsaray - Bang Saray" },
              { propertyId: "property-3", title: "Studio Condo at Club Royal - Naklua" }
            ],
            role: "assistant",
            text: "I found three options."
          }
        ],
        locale: "en",
        message: "which one of them is closer to walking street?"
      })
    ).toMatchObject({
      comparison: "poi-distance",
      mode: "listing-comparison",
      reason: "comparison-follow-up"
    });
  });

  it("routes arbitrary landmark distance comparisons for recent options", () => {
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
        locale: "en",
        message: "which one of them is closer to Sanctuary of Truth?"
      })
    ).toMatchObject({
      comparison: "poi-distance",
      mode: "listing-comparison",
      reason: "comparison-follow-up"
    });
  });

  it("compares recent options for investment instead of starting a new search", () => {
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
        locale: "en",
        message: "which one is better for investment?"
      })
    ).toMatchObject({
      comparison: "investment",
      mode: "listing-comparison",
      reason: "comparison-follow-up"
    });
  });

  it("compares recent options for value for money instead of starting a new search", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Option A" },
              { propertyId: "property-2", title: "Option B" },
              { propertyId: "property-3", title: "Option C" }
            ],
            role: "assistant",
            text: "I found three options."
          }
        ],
        locale: "en",
        message: "I'm not sure, which one would you recommend in terms of value for money?"
      })
    ).toMatchObject({
      comparison: "value",
      mode: "listing-comparison",
      reason: "comparison-follow-up"
    });
  });

  it("compares recent options for relocation and living with pets", () => {
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
        locale: "en",
        message: "which of these is better for relocation and remote work?"
      })
    ).toMatchObject({
      comparison: "relocation",
      mode: "listing-comparison"
    });

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
        locale: "en",
        message: "which option is best with a dog?"
      })
    ).toMatchObject({
      comparison: "pets",
      mode: "listing-comparison"
    });
  });

  it("keeps property detail questions on the selected listing across multiple turns", () => {
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
          },
          { role: "user", text: "I like the second option" },
          {
            recommendedListings: [{ propertyId: "property-2", title: "Option B" }],
            role: "assistant",
            text: "Option B is a good fit."
          },
          { role: "user", text: "is it close to the beach?" },
          {
            recommendedListings: [{ propertyId: "property-2", title: "Option B" }],
            role: "assistant",
            text: "It is 650m from the beach."
          }
        ],
        locale: "en",
        message: "can I bring a dog?"
      })
    ).toMatchObject({
      mode: "property-detail",
      propertyId: "property-2",
      reason: "follow-up-reference"
    });
  });

  it("treats requests for more options as a listing search continuation", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "Option A" },
              { propertyId: "property-2", title: "Option B" }
            ],
            role: "assistant",
            text: "I found 20 matching listings. Here are the top 2."
          }
        ],
        locale: "en",
        message: "can I see more options?"
      })
    ).toMatchObject({
      mode: "listing-search",
      reason: "search-request"
    });
  });

  it("treats broad-search refinements as a new listing search instead of a selected listing detail", () => {
    expect(
      planAiChatRetrieval({
        conversation: [
          {
            recommendedListings: [
              { propertyId: "property-1", title: "3BR House at Dusit Grand Park 2" },
              { propertyId: "property-2", title: "3BR Villa at Dusit Grand Park 2" }
            ],
            role: "assistant",
            text: "I found 16 matching listings."
          }
        ],
        locale: "en",
        message:
          "i mean i would like to rent 1 bedroom or a studio, but quite spacious, beach distance is not important, budget is under 30k, i would like to move in next month"
      })
    ).toMatchObject({
      mode: "listing-search",
      reason: "search-request"
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
