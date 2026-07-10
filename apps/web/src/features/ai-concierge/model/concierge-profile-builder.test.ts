import { describe, expect, it } from "vitest";
import {
  buildConciergeProfile,
  buildConciergeProfileChips,
  buildConciergeRequest
} from "./concierge-profile-builder";

describe("buildConciergeProfile", () => {
  it("detects relocation profile from an English family prompt", () => {
    expect(buildConciergeProfile("Moving to Pattaya with family, remote work, quiet area, budget 3.5M THB")).toEqual({
      budgetThb: 3500000,
      hasChildren: true,
      market: "pattaya",
      purpose: "relocation",
      prefersQuiet: true,
      remoteWork: true
    });
  });

  it("detects monthly rental budget from a rent prompt", () => {
    const profile = buildConciergeProfile("Need to rent in Pattaya for 6 months, beach access, good internet, under 30k THB/month");

    expect(profile).toMatchObject({
      budgetThb: 30000,
      market: "pattaya",
      purpose: "living",
      remoteWork: true
    });
  });

  it("detects investment purpose from yield language", () => {
    expect(buildConciergeProfile("Investment condo in Pattaya above 6% yield near the beach")).toMatchObject({
      market: "pattaya",
      purpose: "investment"
    });
  });

  it("supports Russian wording for budget and family relocation", () => {
    expect(buildConciergeProfile("Переезжаю в Паттайю с семьей, дети, удаленная работа, бюджет до 4 млн бат")).toMatchObject({
      budgetThb: 4000000,
      hasChildren: true,
      market: "pattaya",
      purpose: "relocation",
      remoteWork: true
    });
  });
});

describe("buildConciergeRequest", () => {
  it("keeps the original message and attaches inferred profile", () => {
    const request = buildConciergeRequest("Winter home close to Terminal 21, walkable cafes, reliable internet", {
      hasCar: false,
      prefersQuiet: false
    });

    expect(request.message).toContain("Winter home");
    expect(request.locale).toBe("en");
    expect(request.profile).toMatchObject({
      hasCar: false,
      market: "pattaya",
      purpose: "living",
      prefersQuiet: false,
      remoteWork: true
    });
  });
});

describe("buildConciergeProfileChips", () => {
  it("returns compact visible chips for inferred profile fields", () => {
    expect(
      buildConciergeProfileChips({
        budgetThb: 3500000,
        hasCar: false,
        hasChildren: true,
        market: "pattaya",
        purpose: "family",
        prefersQuiet: false,
        remoteWork: true
      })
    ).toEqual([
      { label: "Market", value: "pattaya" },
      { label: "Budget", value: "3.5M THB" },
      { label: "Purpose", value: "family" },
      { label: "Family", value: "children" },
      { label: "Work", value: "remote" },
      { label: "Area", value: "lively ok" },
      { label: "Mobility", value: "walkable" }
    ]);
  });
});
