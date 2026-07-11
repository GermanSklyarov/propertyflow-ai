import { describe, expect, it } from "vitest";
import { demoConciergeResponse } from "@entities/concierge/model/demo-concierge-response";
import {
  parseConciergeConsoleState,
  stringifyConciergeConsoleState
} from "./concierge-console-storage";

describe("concierge console storage", () => {
  it("restores a saved concierge recommendation state", () => {
    const state = {
      budgetAnswer: "4.2M",
      message: "Moving to Pattaya with children",
      profileOverride: {
        budgetThb: 4200000,
        hasChildren: true
      },
      response: demoConciergeResponse
    };

    expect(parseConciergeConsoleState(stringifyConciergeConsoleState(state))).toEqual(state);
  });

  it("falls back to null for invalid storage payloads", () => {
    expect(parseConciergeConsoleState(null)).toBeNull();
    expect(parseConciergeConsoleState("not-json")).toBeNull();
    expect(parseConciergeConsoleState(JSON.stringify({ response: demoConciergeResponse }))).toBeNull();
  });
});
