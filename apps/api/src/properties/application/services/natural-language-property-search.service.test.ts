import { describe, expect, it } from "vitest";
import { NaturalLanguagePropertySearchService } from "./natural-language-property-search.service.js";

describe("NaturalLanguagePropertySearchService", () => {
  it("extracts strict filters from Russian sea-view condo requests", () => {
    const service = new NaturalLanguagePropertySearchService({} as never, {} as never);

    const interpretation = service.interpret({
      locale: "ru",
      query: "подбери кондо в паттайе с видом на море до 3млн"
    });

    expect(interpretation.filters).toMatchObject({
      market: "pattaya",
      maxPriceThb: 3_000_000,
      requiredAmenities: ["sea-view"]
    });
    expect(interpretation.rankingExplanation).toContain("requiredAmenities=sea-view");
  });
});
