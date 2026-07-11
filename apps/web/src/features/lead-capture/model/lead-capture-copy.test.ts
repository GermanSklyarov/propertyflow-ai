import { describe, expect, it } from "vitest";
import { demoProperties } from "@entities/property/model/demo-properties";
import { getDefaultLeadMessage, getFallbackLeadIntent, getLeadActionLabel, leadIntentOptions } from "./lead-capture-copy";

describe("lead capture copy", () => {
  it("uses rent intent by default for rent-only listings", () => {
    expect(getFallbackLeadIntent(demoProperties[1])).toBe("rental");
    expect(getDefaultLeadMessage(demoProperties[1], "rental")).toContain("lease length");
  });

  it("uses viewing intent by default for buy-capable listings", () => {
    expect(getFallbackLeadIntent(demoProperties[0])).toBe("viewing");
    expect(getDefaultLeadMessage(demoProperties[0], "viewing")).toContain("video tour");
  });

  it("keeps stable labels for all intent actions", () => {
    expect(leadIntentOptions.map((option) => option.value)).toEqual(["viewing", "rental", "investment"]);
    expect(getLeadActionLabel("viewing")).toBe("Request viewing");
    expect(getLeadActionLabel("rental")).toBe("Request rent terms");
    expect(getLeadActionLabel("investment")).toBe("Request ROI review");
  });
});
