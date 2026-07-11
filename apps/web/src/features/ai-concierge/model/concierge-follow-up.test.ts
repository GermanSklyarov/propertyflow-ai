import { describe, expect, it } from "vitest";
import type { ConciergeQuestion } from "@propertyflow/contracts";
import { buildFollowUpOptions, parseBudgetAnswer } from "./concierge-follow-up";

const budgetQuestion: ConciergeQuestion = {
  id: "budgetThb",
  question: "What budget should I stay under?",
  reason: "Budget keeps recommendations realistic."
};

describe("buildFollowUpOptions", () => {
  it("returns rental budget options for rent intent", () => {
    expect(buildFollowUpOptions(budgetQuestion, { listingIntent: "rent" })).toEqual([
      { label: "25k THB/month", patch: { budgetThb: 25000 } },
      { label: "40k THB/month", patch: { budgetThb: 40000 } },
      { label: "60k THB/month", patch: { budgetThb: 60000 } }
    ]);
  });

  it("returns purchase budget options for buy intent", () => {
    expect(buildFollowUpOptions(budgetQuestion, { listingIntent: "sale" })).toEqual([
      { label: "3M THB", patch: { budgetThb: 3000000 } },
      { label: "5M THB", patch: { budgetThb: 5000000 } },
      { label: "8M THB", patch: { budgetThb: 8000000 } }
    ]);
  });

  it("sets living purpose when rent intent is selected", () => {
    expect(
      buildFollowUpOptions(
        {
          id: "listingIntent",
          question: "Rent or buy?",
          reason: "Budget context."
        },
        {}
      )[0]
    ).toEqual({ label: "Rent", patch: { listingIntent: "rent", purpose: "living" } });
  });
});

describe("parseBudgetAnswer", () => {
  it("parses compact monthly and purchase budget answers", () => {
    expect(parseBudgetAnswer("45k")).toBe(45000);
    expect(parseBudgetAnswer("4.2M")).toBe(4200000);
    expect(parseBudgetAnswer("4,2 млн")).toBe(4200000);
    expect(parseBudgetAnswer("3500000")).toBe(3500000);
  });

  it("returns undefined for empty or non-budget text", () => {
    expect(parseBudgetAnswer("")).toBeUndefined();
    expect(parseBudgetAnswer("not sure yet")).toBeUndefined();
  });
});
