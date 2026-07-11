import { describe, expect, it } from "vitest";
import { buildDemoConciergeResponse, demoConciergeResponse } from "./demo-concierge-response";

describe("buildDemoConciergeResponse", () => {
  it("returns intake questions when the fallback profile is incomplete", () => {
    const response = buildDemoConciergeResponse({
      locale: "en",
      message: "I want to move to Pattaya",
      profile: {
        market: "pattaya",
        purpose: "relocation"
      }
    });

    expect(response.stage).toBe("intake");
    expect(response.propertyRecommendations).toEqual([]);
    expect(response.nextQuestions.map((question) => question.id)).toEqual(["listingIntent", "budgetThb", "hasChildren", "hasCar"]);
  });

  it("returns recommendations when the fallback profile has enough answers", () => {
    const response = buildDemoConciergeResponse({
      locale: "en",
      message: "Moving to Pattaya with family, remote work, quiet area, budget 3.5M THB",
      profile: {
        budgetThb: 3500000,
        hasCar: false,
        hasChildren: true,
        listingIntent: "sale",
        market: "pattaya",
        purpose: "relocation",
        prefersQuiet: true,
        remoteWork: true
      }
    });

    expect(response.stage).toBe("recommendation");
    expect(response.nextQuestions).toEqual([]);
    expect(response.propertyRecommendations).toHaveLength(2);
  });

  it("keeps the static demo response as a complete recommendation", () => {
    expect(demoConciergeResponse.stage).toBe("recommendation");
  });
});
