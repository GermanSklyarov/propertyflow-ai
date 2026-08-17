import { describe, expect, it } from "vitest";
import { getAgencyNavigationItems, getAgencyTopbarQuickLinks, getAgencyUpgradeCta, isAgencyNavigationItemActive } from "./agency-navigation";

describe("agency navigation", () => {
  it("keeps the dashboard active only on dashboard routes", () => {
    expect(isAgencyNavigationItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isAgencyNavigationItemActive("/", "/dashboard")).toBe(false);
    expect(isAgencyNavigationItemActive("/leads", "/dashboard")).toBe(false);
  });

  it("matches section roots and nested routes", () => {
    expect(isAgencyNavigationItemActive("/leads", "/leads")).toBe(true);
    expect(isAgencyNavigationItemActive("/leads/lead-demo-001", "/leads")).toBe(true);
  });

  it("does not match routes that merely share a prefix", () => {
    expect(isAgencyNavigationItemActive("/leadership", "/leads")).toBe(false);
    expect(isAgencyNavigationItemActive("/saved-searches", "/saved")).toBe(false);
  });

  it("keeps projects active for CRM workspaces", () => {
    expect(getAgencyNavigationItems("growth").map((item) => item.href)).toContain("/projects");
    expect(isAgencyNavigationItemActive("/projects/the-riviera-wongamat", "/projects")).toBe(true);
  });

  it("keeps Starter navigation focused on AI setup, listings, knowledge, widget demo, leads, and settings", () => {
    const starterItems = getAgencyNavigationItems("starter").map((item) => item.href);
    const starterQuickLinks = getAgencyTopbarQuickLinks("starter").map((item) => item.href);

    expect(starterItems).toEqual(["/setup", "/knowledge", "/listings", "/widget-demo", "/settings", "/leads"]);
    expect(starterQuickLinks).toEqual(["/setup", "/knowledge", "/widget-demo", "/settings", "/leads", "/listings"]);
    expect(starterItems).not.toContain("/dashboard");
    expect(starterItems).not.toContain("/projects");
    expect(starterItems).not.toContain("/analytics");
  });

  it("keeps CRM navigation available for Growth and Enterprise plans", () => {
    expect(getAgencyNavigationItems("growth").map((item) => item.href)).toEqual(
      expect.arrayContaining(["/dashboard", "/listings", "/projects", "/leads", "/saved-searches", "/ai-tools", "/analytics"])
    );
    expect(getAgencyNavigationItems("enterprise").map((item) => item.href)).toEqual(
      expect.arrayContaining(["/dashboard", "/listings", "/projects", "/leads", "/saved-searches", "/ai-tools", "/analytics"])
    );
  });

  it("surfaces Growth upgrade copy only for Starter workspaces", () => {
    expect(getAgencyUpgradeCta("starter")).toEqual(
      expect.objectContaining({
        href: "/setup?plan=growth",
        label: "Start Growth"
      })
    );
    expect(getAgencyUpgradeCta("growth")).toBeNull();
    expect(getAgencyUpgradeCta("enterprise")).toBeNull();
  });
});
