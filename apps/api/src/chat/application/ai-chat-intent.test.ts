import { describe, expect, it } from "vitest";
import { classifyAiChatIntent } from "./ai-chat-intent.js";

describe("classifyAiChatIntent", () => {
  it("routes viewing follow-ups to the previously recommended listing", () => {
    expect(classifyAiChatIntent("I like the first option, may I see it?")).toMatchObject({
      referencedListingIndex: 0,
      route: "property-follow-up"
    });
    expect(classifyAiChatIntent("Can I book the second option?")).toMatchObject({
      referencedListingIndex: 1,
      route: "property-follow-up"
    });
    expect(classifyAiChatIntent("Хочу записаться на просмотр третьего варианта")).toMatchObject({
      referencedListingIndex: 2,
      route: "property-follow-up"
    });
  });

  it("supports Thai and Chinese property follow-up language", () => {
    expect(classifyAiChatIntent("ขอนัดดูตัวเลือกที่สอง")).toMatchObject({
      referencedListingIndex: 1,
      route: "property-follow-up"
    });
    expect(classifyAiChatIntent("我想预约看房第二个")).toMatchObject({
      referencedListingIndex: 1,
      route: "property-follow-up"
    });
  });

  it("keeps ordinary listing requests on the search route", () => {
    expect(classifyAiChatIntent("find me a condo in Pattaya under 3m")).toMatchObject({
      route: "search"
    });
  });

  it("marks advice and neighborhood enrichment independently", () => {
    expect(classifyAiChatIntent("which area is better near cafes for investment?")).toMatchObject({
      includeAdvice: true,
      includeNeighborhood: true,
      route: "search"
    });
  });
});
