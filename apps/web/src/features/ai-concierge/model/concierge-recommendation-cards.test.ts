import { describe, expect, it } from "vitest";
import { demoConciergeResponse } from "@entities/concierge/model/demo-concierge-response";
import { buildConciergeRecommendationCards } from "./concierge-recommendation-cards";

describe("buildConciergeRecommendationCards", () => {
  it("returns no cards until concierge reaches recommendation stage", () => {
    expect(
      buildConciergeRecommendationCards({
        ...demoConciergeResponse,
        stage: "intake",
        propertyRecommendations: []
      })
    ).toEqual([]);
    expect(buildConciergeRecommendationCards(null)).toEqual([]);
  });

  it("maps property recommendations to display cards", () => {
    const cards = buildConciergeRecommendationCards(demoConciergeResponse);

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      fitLabel: "Strong fit",
      href: "/properties/demo-wongamat-sky",
      propertyId: "demo-wongamat-sky",
      scoreLabel: "91 AI score",
      title: "Wongamat Sky Residence"
    });
    expect(cards[1]?.fitLabel).toBe("Moderate fit");
  });
});
